package main

import (
	"context"
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

type PlaybackState int

const (
	IDLE PlaybackState = iota
	PLAY
	PAUSE
	SKIP
	SIGNAL // used to signal the end of a stream session
)

type StreamResult struct {
	Error error
	State PlaybackState
}

type Stream struct {
	Song            *Song
	VoiceConnection *discordgo.VoiceConnection
}

type StreamData struct {
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
	Duration    string
	RequestedBy string
	Position    int
	StreamData  *StreamData
}

type MusicQueue struct {
	isPlaying       bool
	Mutex           sync.RWMutex
	PlaybackState   chan PlaybackState
	VoiceConnection *discordgo.VoiceConnection
	Songs           []Song
}

type External struct {
	Youtube *youtube.Client
}

type Feature struct {
	External   *External
	MusicQueue *MusicQueue
}

type Message struct {
	*discordgo.MessageCreate
	args []string
}

type CallableCommand struct {
	Active  bool
	Name    string
	Execute func(bot *Bot, message *Message)
}

type Command struct {
	Prefix   string
	Callable []CallableCommand
}

type Bot struct {
	Token   string
	Session *discordgo.Session
	Command *Command
	Feature *Feature
}

func PrintObject(obj interface{}) {
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

func deleteDir(dirPath string) error {
	if _, err := os.Stat(dirPath); err != nil {
		return err
	}

	if err := os.RemoveAll(dirPath); err != nil {
		return err
	}

	return nil
}

func deleteFile(filePath string) error {
	if _, err := os.Stat(filePath); err != nil {
		return err
	}

	if err := os.Remove(filePath); err != nil {
		return err
	}

	return nil
}

func writeFile(readable io.ReadCloser, fileName string) error {
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

func (bot *Bot) buildErrorMessageEmbed(message string) *discordgo.MessageEmbed {
	return &discordgo.MessageEmbed{
		Author: &discordgo.MessageEmbedAuthor{
			Name:    "❌ Oops, a wild error appeared! 😱",
			IconURL: bot.Session.State.User.AvatarURL("256"),
		},
		Description: message,
		Footer: &discordgo.MessageEmbedFooter{
			Text: "Please try again later",
		},
		Timestamp: time.Now().Format(time.RFC3339),
		Color:     0xFB3640,
	}
}

func (bot *Bot) buildMessageEmbed(message string) *discordgo.MessageEmbed {
	return &discordgo.MessageEmbed{
		Author: &discordgo.MessageEmbedAuthor{
			Name:    bot.Session.State.User.Username,
			IconURL: bot.Session.State.User.AvatarURL("256"),
		},
		Description: message,
		Footer: &discordgo.MessageEmbedFooter{
			Text: "From space",
		},
		Timestamp: time.Now().Format(time.RFC3339),
		Color:     0x6E76E5,
	}
}

func (song *Song) buildMessageEmbed(queued bool) *discordgo.MessageEmbed {
	if queued {
		return &discordgo.MessageEmbed{
			Author: &discordgo.MessageEmbedAuthor{
				Name: "Queued",
			},
			Title:       song.Title,
			URL:         song.Url,
			Description: fmt.Sprintf("Added to the queue by <@%s> at position %d", song.RequestedBy, song.Position),
			Thumbnail: &discordgo.MessageEmbedThumbnail{
				URL: song.ArtworkUrl,
			},
			Footer: &discordgo.MessageEmbedFooter{
				Text: fmt.Sprintf("Duration: %s", song.Duration),
			},
			Timestamp: time.Now().Format(time.RFC3339),
			Color:     0xFFB319,
		}
	}

	return &discordgo.MessageEmbed{
		Author: &discordgo.MessageEmbedAuthor{
			Name:    "Now playing",
			IconURL: "https://github.com/larahfelipe/saturn/blob/stale-master/src/assets/cd.gif?raw=true",
		},
		Title:       song.Title,
		URL:         song.Url,
		Description: fmt.Sprintf("Requested by <@%s> Enjoy!", song.RequestedBy),
		Thumbnail: &discordgo.MessageEmbedThumbnail{
			URL: song.ArtworkUrl,
		},
		Footer: &discordgo.MessageEmbedFooter{
			Text: fmt.Sprintf("Duration: %s", song.Duration),
		},
		Color: 0x1ED760,
	}
}

func (song *Song) download() (string, error) {
	defer song.StreamData.Readable.Close()

	fe := getFileExtFromMime(song.StreamData.MimeType)
	if len(fe) == 0 {
		return "", errors.New("unable to determine file extension from mime type")
	}

	tn := "temp"
	if _, err := os.Stat(tn); os.IsNotExist(err) {
		if err := os.Mkdir(tn, 0755); err != nil {
			return "", err
		}
	}

	fn := fmt.Sprintf("song-%d.%s", time.Now().Unix(), fe)
	fp := fmt.Sprintf("%s/%s", tn, fn)
	if err := writeFile(song.StreamData.Readable, fp); err != nil {
		return "", err
	}

	return fp, nil
}

func (stream *Stream) stream(ctx context.Context, resultChan chan<- StreamResult) {
	if _, err := exec.LookPath("ffmpeg"); err != nil {
		resultChan <- StreamResult{Error: fmt.Errorf("ffmpeg path lookup error: %s", err)}
		return
	}

	// NOTE: temporarily downloading the song to prevent unexpected streaming behavior.
	// It appears that dca is either unable to encode the stream URL properly or the stream URL provided by youtube-dl is not fully compatible with dca.
	// This is causing playback to stop before the song actually ends.

	sfp, err := stream.Song.download()
	if err != nil {
		resultChan <- StreamResult{Error: fmt.Errorf("stream download error: %s", err)}
		return
	}

	defer func() {
		if err := deleteFile(sfp); err != nil {
			resultChan <- StreamResult{Error: fmt.Errorf("stream file removal error: %s", err)}
		}
	}()

	options := dca.StdEncodeOptions
	options.RawOutput = true
	options.Bitrate = 96

	es, err := dca.EncodeFile(sfp, options)
	if err != nil {
		resultChan <- StreamResult{Error: fmt.Errorf("stream encode error: %s", err)}
		return
	}

	defer es.Cleanup()

	doneChan := make(chan error)
	streamingSession := dca.NewStream(es, stream.VoiceConnection, doneChan)

	// dca signals the end of a stream session by sending an io.EOF error, therefore we need to exclude it as an error
	go func() {
		if err := <-doneChan; err != nil && err != io.EOF {
			resultChan <- StreamResult{Error: fmt.Errorf("stream session error: %v", err)}
		}
	}()

	select {
	case <-ctx.Done():
		// handles the context cancellation
		streamingSession.SetPaused(true)
	case <-doneChan:
		// handles the stream session completion
		resultChan <- StreamResult{State: SIGNAL}
	}
}

func (mq *MusicQueue) shift() *Song {
	if len(mq.Songs) == 0 {
		return nil
	}

	s := mq.Songs[0]
	mq.Songs = mq.Songs[1:]

	return &s
}

func (mq *MusicQueue) cleanup(closeChan bool) {
	if mq.VoiceConnection != nil {
		if err := mq.VoiceConnection.Disconnect(); err != nil {
			zap.L().Error(fmt.Sprintf("voice connection disconnect error: %s", err))
		}

		mq.VoiceConnection.Close()
		mq.VoiceConnection = nil
	}

	mq.isPlaying = false
	mq.Songs = []Song{}

	if err := deleteDir("temp"); err != nil {
		zap.L().Info("temp directory not found, ignoring removal")
	}

	if closeChan {
		close(mq.PlaybackState)
	}
}

func (mq *MusicQueue) add(song *Song) {
	mq.Songs = append(mq.Songs, *song)
}

func (mq *MusicQueue) process() {
	var ctx context.Context
	var cancel context.CancelFunc

	resChan := make(chan StreamResult)
	defer close(resChan)

	for {
		select {
		case ps := <-mq.PlaybackState:
			switch ps {
			case IDLE:
				if len(mq.Songs) == 0 && mq.VoiceConnection != nil {
					mq.cleanup(false)
				}

			case PLAY:
				if len(mq.Songs) == 0 {
					mq.isPlaying = false
					mq.PlaybackState <- IDLE
				}
				ctx, cancel = context.WithCancel(context.Background())

				song := mq.shift()
				if song != nil {
					s := &Stream{
						Song:            song,
						VoiceConnection: mq.VoiceConnection,
					}
					go s.stream(ctx, resChan)
				}

			case PAUSE:
				if cancel != nil {
					cancel()
				}

			case SKIP:
				if cancel != nil {
					cancel()
				}
			}

		case result := <-resChan:
			mq.Mutex.Lock()
			if result.Error != nil {
				zap.L().Error(result.Error.Error())
				mq.cleanup(false)
			}

			if result.State == SIGNAL {
				mq.PlaybackState <- PLAY
			}

			mq.Mutex.Unlock()

		default:
			// timeout to prevent high cpu usage
			time.Sleep(100 * time.Millisecond)
		}
	}
}

func (bot *Bot) makeVoiceConnection(m *Message) (*discordgo.VoiceConnection, error) {
	for _, guild := range bot.Session.State.Guilds {
		for _, vs := range guild.VoiceStates {
			if vs.UserID == m.Author.ID {
				if vs.UserID != bot.Session.State.User.ID {
					bot.Session.ChannelMessageSendEmbed(m.ChannelID, bot.buildMessageEmbed(fmt.Sprintf("Yay! Joining the party on <#%s>", vs.ChannelID)))
				}

				vc, err := bot.Session.ChannelVoiceJoin(guild.ID, vs.ChannelID, false, true)
				if err != nil {
					bot.Session.ChannelMessageSendEmbed(m.ChannelID, bot.buildErrorMessageEmbed("It seems that I'm not in the mood for partying right now. Maybe later?"))
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
		bot.Session.ChannelMessageSendEmbedReply(m.ChannelID, bot.buildErrorMessageEmbed("Guess you forgot to provide a song url"), m.Reference())
		zap.L().Info(fmt.Sprintf("%s didn't provide a song url", m.Author.Username))
		return
	}

	songUrl := m.args[0]

	v, err := bot.Feature.External.Youtube.GetVideo(songUrl)
	if err != nil {
		bot.Session.ChannelMessageSendEmbedReply(m.ChannelID, bot.buildErrorMessageEmbed("It seems something went wrong while searching for your song"), m.Reference())
		zap.L().Error(fmt.Sprintf("youtube video request error: %s", err))
		return
	}

	av := v.Formats.WithAudioChannels()[0]
	rs, _, err := bot.Feature.External.Youtube.GetStream(v, &av)
	if err != nil {
		bot.Session.ChannelMessageSendEmbedReply(m.ChannelID, bot.buildErrorMessageEmbed("It seems something went wrong while searching for your song"), m.Reference())
		zap.L().Error(fmt.Sprintf("youtube stream request error: %s", err))
		return
	}

	mq := bot.Feature.MusicQueue

	mq.Mutex.Lock()
	defer mq.Mutex.Unlock()

	song := &Song{
		Title:       v.Title,
		Url:         songUrl,
		ArtworkUrl:  v.Thumbnails[0].URL,
		Duration:    v.Duration.String(),
		RequestedBy: m.Author.ID,
		Position:    len(mq.Songs) + 1,
		StreamData: &StreamData{
			Url:          av.URL,
			MimeType:     av.MimeType,
			AudioQuality: av.AudioQuality,
			Bitrate:      av.Bitrate,
			Readable:     rs,
		},
	}

	mq.add(song)

	sme := song.buildMessageEmbed(mq.isPlaying)

	if !mq.isPlaying {
		if mq.VoiceConnection == nil {
			vc, err := bot.makeVoiceConnection(m)
			if err != nil {
				bot.Session.ChannelMessageSendEmbed(m.ChannelID, bot.buildErrorMessageEmbed("It seems that I'm not in the mood for partying right now. Maybe later?"))
				zap.L().Error(fmt.Sprintf("voice connection error: %s", err))
				return
			}

			mq.VoiceConnection = vc
		}

		mq.isPlaying = true
		mq.PlaybackState <- PLAY
	}

	bot.Session.ChannelMessageSendEmbed(m.ChannelID, sme)
}

func skipSongCommand(bot *Bot, m *Message) {
	mq := bot.Feature.MusicQueue
	mq.Mutex.Lock()
	defer mq.Mutex.Unlock()

	mq.PlaybackState <- SKIP

	bot.Session.MessageReactionAdd(m.ChannelID, m.ID, "⏭️")
}

func pauseSongCommand(bot *Bot, m *Message) {
	mq := bot.Feature.MusicQueue
	mq.Mutex.Lock()
	defer mq.Mutex.Unlock()

	mq.PlaybackState <- PAUSE

	bot.Session.MessageReactionAdd(m.ChannelID, m.ID, "⏸️")
}

func stopSongCommand(bot *Bot, m *Message) {
	mq := bot.Feature.MusicQueue
	mq.Mutex.Lock()
	defer mq.Mutex.Unlock()

	mq.PlaybackState <- IDLE

	bot.Session.MessageReactionAdd(m.ChannelID, m.ID, "🛑")
}

func healthCommand(bot *Bot, m *Message) {
	latencyMs := bot.Session.HeartbeatLatency().Milliseconds()
	bot.Session.ChannelMessageSendEmbed(m.ChannelID, bot.buildMessageEmbed(fmt.Sprintf("Heartbeat latency: %dms", latencyMs)))
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
		bot.Session.ChannelMessageSendEmbedReply(m.ChannelID, bot.buildErrorMessageEmbed("It seems that you forgot to provide a command"), m.Reference())
		zap.L().Info(fmt.Sprintf("%s triggered an interaction without providing a command", m.Author.Username))
		return
	}

	c := strings.Split(maybeCommand, " ")
	commandRef := c[0]
	commandArgs := c[1:]

	for _, command := range bot.Command.Callable {
		if commandRef == command.Name && command.Active {
			command.Execute(bot, &Message{m, commandArgs})
			zap.L().Info(fmt.Sprintf("%s triggered an interaction for command %s with args %v", m.Author.Username, commandRef, commandArgs))
			return
		}
	}

	bot.Session.ChannelMessageSendEmbedReply(m.ChannelID, bot.buildErrorMessageEmbed(
		"Hmm... something isn't right, maybe you misspelled the command or it's currently unavailable"), m.Reference())
	zap.L().Info(fmt.Sprintf("%s tried to trigger an interaction for an unknown or unavailable command %s with args %v", m.Author.Username, commandRef, commandArgs))
}

func setupDiscordBot(token, prefix string) (*Bot, error) {
	if len(token) == 0 || len(prefix) == 0 {
		return nil, errors.New("missing required environment variables error")
	}

	bot := &Bot{
		Token:   token,
		Session: nil,
		Command: &Command{
			Prefix: prefix,
			Callable: []CallableCommand{
				{
					Active:  true,
					Name:    "ping",
					Execute: pingCommand,
				},
				{
					Active:  true,
					Name:    "health",
					Execute: healthCommand,
				},
				{
					Active:  true,
					Name:    "play",
					Execute: playSongCommand,
				},
				{
					Active:  false,
					Name:    "skip",
					Execute: skipSongCommand,
				},
				{
					Active:  false,
					Name:    "pause",
					Execute: pauseSongCommand,
				},
				{
					Active:  true,
					Name:    "stop",
					Execute: stopSongCommand,
				},
			},
		},
		Feature: &Feature{
			External: &External{
				Youtube: &youtube.Client{},
			},
			MusicQueue: &MusicQueue{
				PlaybackState: make(chan PlaybackState, 1),
				Songs:         []Song{},
			},
		},
	}

	ds, err := discordgo.New("Bot " + bot.Token)
	if err != nil {
		return nil, err
	}

	bot.Session = ds
	bot.Session.AddHandler(bot.onMessageInteractionCreate)

	return bot, nil
}

func setupLogger() {
	zl := zap.Must(zap.NewProduction())

	if env := os.Getenv("APP_ENV"); env == "development" {
		zl = zap.Must(zap.NewDevelopment())
	}

	zap.ReplaceGlobals(zl)
}

func main() {
	if err := env.Load(); err != nil {
		panic(fmt.Sprintf("environment variables load error: %s", err))
	}

	setupLogger()

	bot, err := setupDiscordBot(os.Getenv("BOT_TOKEN"), os.Getenv("BOT_PREFIX"))
	if err != nil {
		zap.L().Fatal(fmt.Sprintf("discord bot creation error: %s", err))
	}

	if err := bot.Session.Open(); err != nil {
		zap.L().Fatal(fmt.Sprintf("discord websocket open connection error: %s", err))
	}

	bot.Session.UpdateWatchStatus(0, "the stars")

	go bot.Feature.MusicQueue.process()

	defer bot.Feature.MusicQueue.cleanup(true)

	fmt.Println("")
	zap.L().Info(fmt.Sprintf("bot is now connected as %s and it's ready to listen for interactions", bot.Session.State.User.Username))

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM, os.Interrupt)
	<-sigChan

	if err := bot.Session.Close(); err != nil {
		zap.L().Fatal(fmt.Sprintf("discord websocket close connection error: %s", err))
	}
}
