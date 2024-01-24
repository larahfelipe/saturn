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
	"time"

	"github.com/bwmarrin/discordgo"
	env "github.com/joho/godotenv"
	"github.com/jonas747/dca"
	"github.com/kkdai/youtube/v2"
	"go.uber.org/zap"
)

type Status int

const (
	IDLE    Status = 0
	PLAYING Status = 1
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

type MusicQueue struct {
	Status          chan Status
	Mutex           sync.RWMutex
	VoiceConnection *discordgo.VoiceConnection
	Songs           []Song
}

type Integrations struct {
	Youtube *youtube.Client
}

type Features struct {
	Integrations *Integrations
	MusicQueue   *MusicQueue
}

type Message struct {
	*discordgo.MessageCreate
	args []string
}

type CallableCommand struct {
	Name    string
	Execute func(bot *Bot, message *Message)
}

type Command struct {
	Prefix   string
	Callable []CallableCommand
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
	defer song.Stream.Readable.Close()

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

func stream(song *Song, vc *discordgo.VoiceConnection) error {
	if _, err := exec.LookPath("ffmpeg"); err != nil {
		return fmt.Errorf("ffmpeg path lookup error: %s", err)
	}

	if !vc.Ready {
		return errors.New("voice connection is not ready")
	}

	// NOTE: temporarily downloading the song to prevent unexpected streaming behavior.
	// It appears that dca is either unable to encode the stream URL properly or the stream URL provided by youtube-dl is not fully compatible with dca.
	// This is causing playback to stop before the song actually ends.

	sfp, err := song.download()
	if err != nil {
		return fmt.Errorf("stream download error: %s", err)
	}

	defer func() error {
		if err := os.Remove(sfp); err != nil {
			return fmt.Errorf("stream file removal error: %s", err)
		}

		return nil
	}()

	// TODO: check the bitrate of the voice channel and set the bitrate of the song accordingly

	options := dca.StdEncodeOptions
	options.RawOutput = true
	options.Bitrate = 96

	es, err := dca.EncodeFile(sfp, options)
	if err != nil {
		return fmt.Errorf("stream encode error: %s", err)
	}

	defer es.Cleanup()

	done := make(chan error)
	dca.NewStream(es, vc, done)

	se := <-done
	if se != nil && se != io.EOF {
		return fmt.Errorf("stream broadcast error: %s", se)
	}

	return nil
}

func (mq *MusicQueue) shift() *Song {
	if len(mq.Songs) == 0 {
		return nil
	}

	s := mq.Songs[0]
	mq.Songs = mq.Songs[1:]

	return &s
}

func (mq *MusicQueue) add(song *Song) {
	mq.Songs = append(mq.Songs, *song)
}

func (mq *MusicQueue) process() {
	for {
		select {
		case queueStatus := <-mq.Status:
			switch queueStatus {
			case IDLE:
				if len(mq.Songs) == 0 && mq.VoiceConnection != nil {
					mq.VoiceConnection.Disconnect()
					mq.VoiceConnection = nil
				}

			case PLAYING:
				mq.Mutex.Lock()

				if len(mq.Songs) > 0 {
					song := mq.shift()

					if err := stream(song, mq.VoiceConnection); err != nil {
						zap.L().Error(err.Error())
					}
				} else {
					mq.Status <- IDLE
				}

				mq.Mutex.Unlock()
			}

		default:
			// small sleep to prevent this loop from consuming too much cpu
			time.Sleep(100 * time.Millisecond)
		}
	}
}

func (bot *Bot) makeVoiceConnection(m *Message) (*discordgo.VoiceConnection, error) {
	for _, guild := range bot.Session.State.Guilds {
		for _, vs := range guild.VoiceStates {
			if vs.UserID == m.Author.ID {
				// TODO: check if the bot is already in the same voice channel as the user who requested the song

				if vs.UserID != bot.Session.State.User.ID {
					bot.Session.ChannelMessageSend(m.ChannelID, fmt.Sprintf("Yay! Joining the party on <#%s>", vs.ChannelID))
				}

				vc, err := bot.Session.ChannelVoiceJoin(guild.ID, vs.ChannelID, false, true)
				if err != nil {
					bot.Session.ChannelMessageSend(m.ChannelID, "Oops! It seems that I'm not in the mood for partying right now. Maybe later?")
					return nil, err
				}

				return vc, nil
			}
		}
	}

	return nil, errors.New("unable to find a voice channel for the user who requested the song")
}

func playSongCommand(bot *Bot, m *Message) {
	if len(m.args) == 0 {
		bot.Session.ChannelMessageSendReply(m.ChannelID, "Guess you forgot to provide a song url", m.Reference())
		zap.L().Info(fmt.Sprintf("%s didn't provide a song url", m.Author.Username))
		return
	}

	songUrl := m.args[0]

	v, err := bot.Features.Integrations.Youtube.GetVideo(songUrl)
	if err != nil {
		bot.Session.ChannelMessageSendReply(m.ChannelID, "Oops! It seems something went wrong while searching for your song. Please try again later", m.Reference())
		zap.L().Error(fmt.Sprintf("youtube video request error: %s", err))
		return
	}

	av := v.Formats.WithAudioChannels()[0]
	rs, _, err := bot.Features.Integrations.Youtube.GetStream(v, &av)
	if err != nil {
		bot.Session.ChannelMessageSendReply(m.ChannelID, "Oops! It seems something went wrong while searching for your song. Please try again later", m.Reference())
		zap.L().Error(fmt.Sprintf("youtube stream request error: %s", err))
		return
	}

	mq := bot.Features.MusicQueue
	mq.Mutex.Lock()

	song := &Song{
		Title:       v.Title,
		Url:         songUrl,
		ArtworkUrl:  v.Thumbnails[0].URL,
		Duration:    v.Duration.Minutes(),
		RequestedBy: m.Author.ID,
		Position:    len(mq.Songs) + 1,
		Stream: &Stream{
			Url:          av.URL,
			MimeType:     av.MimeType,
			AudioQuality: av.AudioQuality,
			Bitrate:      av.Bitrate,
			Readable:     rs,
		},
	}

	mq.add(song)

	if len(mq.Songs) == 0 {
		vc, err := bot.makeVoiceConnection(m)
		if err != nil {
			bot.Session.ChannelMessageSend(m.ChannelID, "Error connecting to voice channel: "+err.Error())
			zap.L().Error("Error connecting to voice channel: " + err.Error())
			mq.Mutex.Unlock()
			return
		}

		mq.VoiceConnection = vc

		bot.Session.ChannelMessageSend(m.ChannelID, fmt.Sprintf("Now playing [%s](%s)", song.Title, song.Url))
		mq.Status <- PLAYING
	} else {
		bot.Session.ChannelMessageSend(m.ChannelID, fmt.Sprintf("Got it! [%s](%s) has been queued at position %d", song.Title, song.Url, song.Position))
	}

	mq.Mutex.Unlock()
}

func skipSongCommand(bot *Bot, m *Message) {
	bot.Session.MessageReactionAdd(m.ChannelID, m.ID, "⏭️")
}

func stopSongCommand(bot *Bot, m *Message) {
	bot.Session.MessageReactionAdd(m.ChannelID, m.ID, "🛑")
}

func healthCommand(bot *Bot, m *Message) {
	latencyMs := bot.Session.HeartbeatLatency().Milliseconds()
	bot.Session.ChannelMessageSendReply(m.ChannelID, fmt.Sprintf("Heartbeat latency: %dms", latencyMs), m.Reference())
}

func pingCommand(bot *Bot, m *Message) {
	bot.Session.ChannelMessageSendReply(m.ChannelID, "Pong!", m.Reference())
}

func (bot *Bot) onMessageInteractionCreate(_ *discordgo.Session, m *discordgo.MessageCreate) {
	if m.Author.Bot || !strings.HasPrefix(m.Content, bot.Command.Prefix) {
		return
	}

	maybeCommand := strings.TrimLeft(m.Content, bot.Command.Prefix)
	if len(maybeCommand) == 0 {
		bot.Session.ChannelMessageSendReply(m.ChannelID, "Hmm... It seems that you forgot to provide a command", m.Reference())
		zap.L().Info(fmt.Sprintf("%s triggered an interaction without providing a command", m.Author.Username))
		return
	}

	c := strings.Split(maybeCommand, " ")
	commandRef := c[0]
	commandArgs := c[1:]

	for _, command := range bot.Command.Callable {
		if commandRef == command.Name {
			command.Execute(bot, &Message{m, commandArgs})
			zap.L().Info(fmt.Sprintf("%s triggered an interaction for command %s with args %v", m.Author.Username, commandRef, commandArgs))
			return
		}
	}

	bot.Session.ChannelMessageSendReply(m.ChannelID, "Hmm... I'm not sure if I know that command, can you check if you typed it correctly?", m.Reference())
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
			Callable: []CallableCommand{
				{
					Name:    "ping",
					Execute: pingCommand,
				},
				{
					Name:    "health",
					Execute: healthCommand,
				},
				{
					Name:    "play",
					Execute: playSongCommand,
				},
				{
					Name:    "skip",
					Execute: skipSongCommand,
				},
				{
					Name:    "stop",
					Execute: stopSongCommand,
				},
			},
		},
		Features: &Features{
			Integrations: &Integrations{
				Youtube: &youtube.Client{},
			},
			MusicQueue: &MusicQueue{
				Status: make(chan Status),
				Songs:  []Song{},
			},
		},
	}

	ds, err := discordgo.New("Bot " + bot.Token)
	if err != nil {
		zap.L().Fatal(fmt.Sprintf("discord session creation error: %s", err))
	}

	bot.Session = ds
	bot.Session.AddHandler(bot.onMessageInteractionCreate)

	err = bot.Session.Open()
	if err != nil {
		zap.L().Fatal(fmt.Sprintf("discord websocket open connection error: %s", err))
	}

	bot.Session.UpdateWatchStatus(0, "the stars")

	go bot.Features.MusicQueue.process()

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
