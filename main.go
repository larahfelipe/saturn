package main

import (
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"os/signal"
	"reflect"
	"regexp"
	"strings"
	"sync"
	"syscall"

	"github.com/bwmarrin/discordgo"
	env "github.com/joho/godotenv"
	"github.com/jonas747/dca"
	"github.com/kkdai/youtube/v2"
	"go.uber.org/zap"
)

type Status int

const (
	IDLE     Status = 0
	PLAYING  Status = 1
	PAUSING  Status = 2
	SKIPPING Status = 3
)

type Stream struct {
	Url          string
	MimeType     string
	AudioQuality string
	Bitrate      int
	Readable     io.ReadCloser
}

type Song struct {
	Title       string
	Url         string
	ArtworkUrl  string
	Duration    float64
	RequestedBy string
	Position    int
	Stream      *Stream
}

type Queue struct {
	Status chan Status
	Mutex  *sync.Mutex
	Songs  []Song
}

type Integrations struct {
	Youtube *youtube.Client
}

type Features struct {
	Integrations *Integrations
	Queue        *Queue
}

type CallableCommand struct {
	Name    string
	Execute func(bot *Bot, session *discordgo.Session, message *discordgo.MessageCreate, args []string)
}

type Command struct {
	Prefix string
	All    []CallableCommand
}

type Bot struct {
	Token    string
	Session  *discordgo.Session
	Command  *Command
	Features *Features
}

func printObject(obj interface{}) {
	valueOfObj := reflect.ValueOf(obj)

	if valueOfObj.Kind() != reflect.Struct {
		fmt.Println("input object is not a struct")
		return
	}

	for i := 0; i < valueOfObj.NumField(); i++ {
		field := valueOfObj.Type().Field(i)
		fieldValue := valueOfObj.Field(i).Interface()

		fmt.Printf("%s: %v\n", field.Name, fieldValue)
	}
}

func getFileExtFromMime(mimeType string) string {
	pattern := `\/([^;\s]+)`
	re := regexp.MustCompile(pattern)

	sm := re.FindStringSubmatch(mimeType)
	if len(sm) < 1 {
		return ""
	}

	return sm[1]
}

func writeFile(readable io.ReadCloser, fileName string) error {
	// TODO: Check if a file with the same name already exists and if so, rename it

	f, err := os.Create(fileName)
	if err != nil {
		return err
	}

	defer f.Close()

	if _, err := io.Copy(f, readable); err != nil {
		return err
	}

	return nil
}

func (song *Song) download() (string, error) {
	fileExt := getFileExtFromMime(song.Stream.MimeType)
	if len(fileExt) == 0 {
		return "", errors.New("unable to determine file extension from mime type")
	}

	tempDirName := "temp"
	if _, err := os.Stat(tempDirName); os.IsNotExist(err) {
		if err := os.Mkdir(tempDirName, 0755); err != nil {
			return "", err
		}
	}

	fileName := fmt.Sprintf("%s.%s", song.Title, fileExt)
	filePath := fmt.Sprintf("%s/%s", tempDirName, fileName)
	if err := writeFile(song.Stream.Readable, filePath); err != nil {
		return "", err
	}

	return filePath, nil
}

func (song *Song) stream(s *discordgo.Session, m *discordgo.MessageCreate) {
	defer song.Stream.Readable.Close()

	for _, guild := range s.State.Guilds {
		for _, voiceState := range guild.VoiceStates {
			if voiceState.UserID == m.Author.ID {
				// TODO: check if the bot is already in the same voice channel as the user who requested the song

				if voiceState.UserID != s.State.User.ID {
					s.ChannelMessageSend(m.ChannelID, fmt.Sprintf("Yay! Joining the party on <#%s>", voiceState.ChannelID))
				}

				vc, err := s.ChannelVoiceJoin(guild.ID, voiceState.ChannelID, false, true)
				if err != nil {
					s.ChannelMessageSend(m.ChannelID, "Oops! It seems that I'm not in the mood for singing right now. Please try again later.")
					zap.L().Error(fmt.Sprintf("voice connection join event error: %s", err))
					return
				}

				if err := vc.Speaking(true); err != nil {
					zap.L().Error(fmt.Sprintf("voice connection speak event error: %s", err))
					return
				}

				defer vc.Speaking(false)

				s.ChannelMessageSend(m.ChannelID, fmt.Sprintf("Now playing [%s](%s)", song.Title, song.Url))

				// NOTE: temporarily downloading the song to prevent unexpected streaming behavior.
				// It appears that dca is either unable to encode the stream URL properly or the stream URL provided by youtube-dl is not fully compatible with dca.
				// This is causing playback to stop before the song actually ends.

				sfp, err := song.download()
				if err != nil {
					zap.L().Error(fmt.Sprintf("stream download error: %s", err))
					return
				}

				defer func() {
					if err := os.Remove(sfp); err != nil {
						zap.L().Error(fmt.Sprintf("stream file removal error: %s", err))
					}
				}()

				// TODO: check the bitrate of the voice channel and set the bitrate of the song accordingly

				options := dca.StdEncodeOptions
				options.RawOutput = true
				options.Bitrate = 96

				es, err := dca.EncodeFile(sfp, options)
				if err != nil {
					zap.L().Error(fmt.Sprintf("stream encode error: %s", err))
					return
				}

				defer es.Cleanup()

				done := make(chan error)
				dca.NewStream(es, vc, done)

				se := <-done
				if se != nil && se != io.EOF {
					zap.L().Error(fmt.Sprintf("stream broadcast error: %s", se))
					return
				}
			}
		}
	}
}

func (queue *Queue) shift() Song {
	if len(queue.Songs) == 0 {
		return Song{}
	}

	s := queue.Songs[0]
	queue.Songs = queue.Songs[1:]

	return s
}

func (queue *Queue) add(song *Song) {
	queue.Songs = append(queue.Songs, *song)
}

func (queue *Queue) clear() {
	queue.Songs = []Song{}
}

func (queue *Queue) process(s *discordgo.Session, m *discordgo.MessageCreate) {
	queue.Mutex.Lock()
	defer queue.Mutex.Unlock()

	if len(queue.Songs) == 0 {
		queue.Status <- IDLE
		return
	}

	switch <-queue.Status {
	case PLAYING:
		queue.Status <- PLAYING
		song := queue.shift()
		song.stream(s, m)

	case PAUSING:
		fmt.Println("Pausing song")
		queue.Status <- PAUSING

	case SKIPPING:
		fmt.Println("Skipping song")
		queue.Status <- PLAYING
		s.ChannelMessageSend(m.ChannelID, fmt.Sprintf("Skipping [%s](%s)", queue.Songs[0].Title, queue.Songs[0].Url))
		queue.Songs = queue.Songs[1:]

	default:
		queue.Status <- IDLE
		return
	}

	go queue.process(s, m)
}

func playSongCommand(bot *Bot, s *discordgo.Session, m *discordgo.MessageCreate, args []string) {
	if _, err := exec.LookPath("ffmpeg"); err != nil {
		s.ChannelMessageSendReply(m.ChannelID, "Oops! It seems that this command is not available at the moment. Please try again later", m.Reference())
		zap.L().Error(fmt.Sprintf("ffmpeg path lookup error: %s", err))
		return
	}

	if len(args) == 0 {
		s.ChannelMessageSendReply(m.ChannelID, "Guess you forgot to provide a song url", m.Reference())
		zap.L().Info(fmt.Sprintf("%s didn't provide a song url", m.Author.Username))
		return
	}

	songUrl := args[0]

	v, err := bot.Features.Integrations.Youtube.GetVideo(songUrl)
	if err != nil {
		s.ChannelMessageSendReply(m.ChannelID, "Oops! It seems something went wrong while searching for your song. Please try again later", m.Reference())
		zap.L().Error(fmt.Sprintf("youtube video request error: %s", err))
		return
	}

	av := v.Formats.WithAudioChannels()[0]
	rs, _, err := bot.Features.Integrations.Youtube.GetStream(v, &av)
	if err != nil {
		s.ChannelMessageSendReply(m.ChannelID, "Oops! It seems something went wrong while searching for your song. Please try again later", m.Reference())
		zap.L().Error(fmt.Sprintf("youtube stream request error: %s", err))
		return
	}

	song := &Song{
		Title:       v.Title,
		Url:         songUrl,
		ArtworkUrl:  v.Thumbnails[0].URL,
		Duration:    v.Duration.Minutes(),
		RequestedBy: m.Author.ID,
		Position:    len(bot.Features.Queue.Songs) + 1,
		Stream: &Stream{
			Url:          av.URL,
			MimeType:     av.MimeType,
			AudioQuality: av.AudioQuality,
			Bitrate:      av.Bitrate,
			Readable:     rs,
		},
	}

	if <-bot.Features.Queue.Status == PLAYING {
		s.ChannelMessageSend(m.ChannelID, fmt.Sprintf("Got it! [%s](%s) has been queued at position %d", song.Title, song.Url, song.Position))
	}

	bot.Features.Queue.Status <- PLAYING
	bot.Features.Queue.add(song)
	bot.Features.Queue.process(s, m)
}

func skipSongCommand(bot *Bot, s *discordgo.Session, m *discordgo.MessageCreate, args []string) {
	// bot.Features.Queue.Mutex.Lock()
	// defer bot.Features.Queue.Mutex.Unlock()

	// if <-bot.Features.Queue.Status != PLAYING || len(bot.Features.Queue.Songs) == 0 {
	// 	s.ChannelMessageSendReply(m.ChannelID, "Oops! It seems that there's nothing to skip at the moment", m.Reference())
	// 	return
	// }

	bot.Features.Queue.Status <- SKIPPING

	s.MessageReactionAdd(m.ChannelID, m.ID, "⏭️")
}

func stopSongCommand(bot *Bot, s *discordgo.Session, m *discordgo.MessageCreate, args []string) {
	// bot.Features.Queue.Mutex.Lock()
	// defer bot.Features.Queue.Mutex.Unlock()

	// if <-bot.Features.Queue.Status != PLAYING {
	// 	s.ChannelMessageSendReply(m.ChannelID, "Oops! It seems that there's nothing to stop at the moment", m.Reference())
	// 	return
	// }

	bot.Features.Queue.clear()
	bot.Features.Queue.Status <- IDLE

	s.MessageReactionAdd(m.ChannelID, m.ID, "🛑")
}

func pingCommand(bot *Bot, s *discordgo.Session, m *discordgo.MessageCreate, args []string) {
	s.ChannelMessageSendReply(m.ChannelID, "Pong!", m.Reference())
}

func (bot *Bot) onMessageInteractionCreate(s *discordgo.Session, m *discordgo.MessageCreate) {
	if m.Author.Bot || !strings.HasPrefix(m.Content, bot.Command.Prefix) {
		return
	}

	maybeCommand := strings.TrimLeft(m.Content, bot.Command.Prefix)
	if len(maybeCommand) == 0 {
		s.ChannelMessageSendReply(m.ChannelID, "Hmm... It seems that you forgot to provide a command", m.Reference())
		zap.L().Info(fmt.Sprintf("%s triggered an interaction without providing a command", m.Author.Username))
		return
	}

	c := strings.Split(maybeCommand, " ")
	commandRef := c[0]
	commandArgs := c[1:]

	for _, command := range bot.Command.All {
		if commandRef == command.Name {
			command.Execute(bot, s, m, commandArgs)
			zap.L().Info(fmt.Sprintf("%s triggered an interaction for command %s with args %v", m.Author.Username, commandRef, commandArgs))
			return
		}
	}

	s.ChannelMessageSendReply(m.ChannelID, "Hmm... I'm not sure if I know that command, can you check if you typed it correctly?", m.Reference())
	zap.L().Info(fmt.Sprintf("%s tried to trigger an interaction for an unknown command %s with args %v", m.Author.Username, commandRef, commandArgs))
}

func main() {
	if err := env.Load(); err != nil {
		panic(fmt.Sprintf("environment variables load error: %s", err))
	}

	zl := zap.Must(zap.NewProduction())
	appEnv := os.Getenv("APP_ENV")
	if appEnv == "development" {
		zl = zap.Must(zap.NewDevelopment())
	}

	zap.ReplaceGlobals(zl)

	botToken := os.Getenv("BOT_TOKEN")
	botPrefix := os.Getenv("BOT_PREFIX")
	if len(botToken) == 0 || len(botPrefix) == 0 {
		zap.L().Fatal("missing required environment variables error")
	}

	bot := Bot{
		Token:   botToken,
		Session: nil,
		Command: &Command{
			Prefix: botPrefix,
			All: []CallableCommand{
				{
					Name:    "ping",
					Execute: pingCommand,
				},
				{
					Name:    "play",
					Execute: playSongCommand,
				},
				// {
				// 	Name:    "skip",
				// 	Execute: skipSongCommand,
				// },
				// {
				// 	Name:    "stop",
				// 	Execute: stopSongCommand,
				// },
			},
		},
		Features: &Features{
			Queue: &Queue{
				Status: make(chan Status, 1),
				Mutex:  &sync.Mutex{},
				Songs:  []Song{},
			},
			Integrations: &Integrations{
				Youtube: &youtube.Client{},
			},
		},
	}

	ds, err := discordgo.New("Bot " + bot.Token)
	if err != nil {
		zap.L().Fatal(fmt.Sprintf("discord session creation error: %s", err))
	}

	go func() {
		bot.Features.Queue.Status <- IDLE
	}()

	bot.Session = ds
	bot.Session.AddHandler(bot.onMessageInteractionCreate)

	err = bot.Session.Open()
	if err != nil {
		zap.L().Fatal(fmt.Sprintf("discord websocket open connection error: %s", err))
	}

	fmt.Println("")
	zap.L().Info(fmt.Sprintf("bot is now connected as %s and it's ready to listen for interactions", bot.Session.State.User.Username))
	zap.L().Info("press CTRL-C to kill the process and exit")

	sc := make(chan os.Signal, 1)
	signal.Notify(sc, syscall.SIGINT, syscall.SIGTERM, os.Interrupt)
	<-sc

	if err := bot.Session.Close(); err != nil {
		zap.L().Fatal(fmt.Sprintf("discord websocket close connection error: %s", err))
	}
}
