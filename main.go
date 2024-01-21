package main

import (
	"errors"
	"fmt"
	"io"
	"log"
	"os"
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
	Status string
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

const (
	Idle    = "IDLE"
	Playing = "PLAYING"
	Paused  = "PAUSED"
)

func printObject(obj interface{}) {
	valueOfObj := reflect.ValueOf(obj)

	if valueOfObj.Kind() != reflect.Struct {
		log.Println("input object is not a struct")
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
					log.Println("[exception] Voice connection join event error:", err)
					return
				}

				if err := vc.Speaking(true); err != nil {
					log.Println("[exception] Voice connection speak event error:", err)
					return
				}

				defer vc.Speaking(false)

				s.ChannelMessageSend(m.ChannelID, fmt.Sprintf("Now playing [%s](%s)", song.Title, song.Url))

				// NOTE: temporarily downloading the song to prevent unexpected streaming behavior.
				// It appears that dca is either unable to encode the stream URL properly or the stream URL provided by youtube-dl is not fully compatible with dca.
				// This is causing playback to stop before the song actually ends.

				sfp, err := song.download()
				if err != nil {
					log.Println("[exception] Stream download error:", err)
					return
				}

				defer os.Remove(sfp)

				// TODO: check the bitrate of the voice channel and set the bitrate of the song accordingly

				options := dca.StdEncodeOptions
				options.RawOutput = true
				options.Bitrate = 96

				es, err := dca.EncodeFile(sfp, options)
				if err != nil {
					log.Println("[exception] Stream encode error:", err)
					return
				}

				defer es.Cleanup()

				done := make(chan error)
				dca.NewStream(es, vc, done)

				se := <-done
				if se != nil && se != io.EOF {
					log.Println("[exception] Stream broadcast error:", se)
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

func (queue *Queue) add(song *Song) Song {
	queue.Songs = append(queue.Songs, *song)

	return *song
}

func (queue *Queue) process(s *discordgo.Session, m *discordgo.MessageCreate) {
	queue.Mutex.Lock()
	defer queue.Mutex.Unlock()

	if len(queue.Songs) == 0 {
		queue.Status = Idle
		return
	}

	queue.Status = Playing

	song := queue.shift()
	song.stream(s, m)

	go queue.process(s, m)
}

func playSongCommand(bot *Bot, s *discordgo.Session, m *discordgo.MessageCreate, args []string) {
	// TODO: check if the host pc has required dependencies installed - ffmpeg

	if len(args) == 0 {
		s.ChannelMessageSendReply(m.ChannelID, "Guess you forgot to provide a song url", m.Reference())
		return
	}

	songUrl := args[0]

	v, err := bot.Features.Integrations.Youtube.GetVideo(songUrl)
	if err != nil {
		s.ChannelMessageSendReply(m.ChannelID, "Oops! It seems something went wrong while searching for your song. Please try again later", m.Reference())
		log.Println("[exception] Youtube video request error:", err)
		return
	}

	av := v.Formats.WithAudioChannels()[0]
	rs, _, err := bot.Features.Integrations.Youtube.GetStream(v, &av)
	if err != nil {
		s.ChannelMessageSendReply(m.ChannelID, "Oops! It seems something went wrong while searching for your song. Please try again later", m.Reference())
		log.Println("[exception] Youtube stream request error:", err)
		return
	}

	song := bot.Features.Queue.add(&Song{
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
	})

	if bot.Features.Queue.Status == Playing {
		s.ChannelMessageSend(m.ChannelID, fmt.Sprintf("Got it! [%s](%s) has been queued at position %d", song.Title, song.Url, song.Position))
	}

	bot.Features.Queue.process(s, m)
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
		s.ChannelMessageSend(m.ChannelID, "Hmm... It seems that you forgot to provide a command")
		return
	}

	c := strings.Split(maybeCommand, " ")
	commandRef := c[0]
	commandArgs := c[1:]

	for _, command := range bot.Command.All {
		if commandRef == command.Name {
			command.Execute(bot, s, m, commandArgs)
			return
		}
	}
}

func main() {
	if err := env.Load(); err != nil {
		panic(fmt.Sprintf("[fatal] Environment variables load error: %s", err))
	}

	botToken := os.Getenv("BOT_TOKEN")
	botPrefix := os.Getenv("BOT_PREFIX")
	if len(botToken) == 0 || len(botPrefix) == 0 {
		panic("[fatal] Missing required environment variables error")
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
			},
		},
		Features: &Features{
			Queue: &Queue{
				Status: Idle,
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
		panic(fmt.Sprintf("[fatal] Discord session creation error: %s", err))
	}

	bot.Session = ds
	bot.Session.AddHandler(bot.onMessageInteractionCreate)

	err = bot.Session.Open()
	if err != nil {
		panic(fmt.Sprintf("[fatal] Discord websocket open connection error: %s", err))
	}

	log.Println(strings.Repeat("-", 20))
	log.Println("[info] Bot is connected and ready to listen for interactions")
	log.Println("[info] Press CTRL-C to kill the process and exit")

	sc := make(chan os.Signal, 1)
	signal.Notify(sc, syscall.SIGINT, syscall.SIGTERM, os.Interrupt)
	<-sc

	if err := bot.Session.Close(); err != nil {
		panic(fmt.Sprintf("[fatal] Discord websocket close connection error: %s", err))
	}
}
