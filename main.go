package main

import (
	"fmt"
	"os"
	"os/signal"
	"strings"
	"syscall"

	"github.com/bwmarrin/discordgo"
	"github.com/jonas747/dca"
)

type Song struct {
	Title       string
	Url         string
	StreamUrl   string
	Duration    string
	ArtworkUrl  string
	RequestedBy string
	Position    int
}

type Queue struct {
	Lock  bool
	Songs []Song
}

type Bot struct {
	Token         string
	CommandPrefix string
	Session       *discordgo.Session
	Queue         *Queue
}

type Command struct {
	Name    string
	Args    []string
	Execute func(bot *Bot, session *discordgo.Session, message *discordgo.MessageCreate, args []string)
}

func (queue *Queue) add(song Song) {
	queue.Songs = append(queue.Songs, song)
}

func (queue *Queue) shift() Song {
	if len(queue.Songs) == 0 {
		return Song{}
	}

	s := queue.Songs[0]
	queue.Songs = queue.Songs[1:]

	return s
}

func (song *Song) streamNow(vc *discordgo.VoiceConnection, filePath string) {
	options := dca.StdEncodeOptions
	options.RawOutput = true
	options.Bitrate = 96

	// TODO: fix the encoding and streaming process

	es, err := dca.EncodeFile(filePath, options)
	if err != nil {
		fmt.Println("[exception] File encoding error:", err)
		return
	}

	defer es.Cleanup()

	if !vc.Ready {
		fmt.Println("[exception] Voice connection is not ready")
		return
	}

	vc.Speaking(true)
	defer vc.Speaking(false)

	done := make(chan error)
	dca.NewStream(es, vc, done)

	<-done
}

func (queue *Queue) process(s *discordgo.Session, m *discordgo.MessageCreate) {
	if len(queue.Songs) == 0 {
		s.ChannelMessageSend(m.ChannelID, "Party's over. Goodbye!")
		return
	}

	if queue.Lock {
		return
	}

	if len(queue.Songs) != 0 && queue.Lock {
		lastSong := queue.Songs[len(queue.Songs)-1]
		s.ChannelMessageSend(m.ChannelID, fmt.Sprintf("Got it! %s has been added to the queue, and his position is %d", lastSong.Title, lastSong.Position))
		return
	}

	queue.Lock = true
	song := queue.shift()

	for _, guild := range s.State.Guilds {
		for _, voiceState := range guild.VoiceStates {
			// TODO: check if the user is in the same voice channel as the bot

			if voiceState.UserID == m.Author.ID {
				if voiceState.UserID != s.State.User.ID {
					s.ChannelMessageSend(m.ChannelID, fmt.Sprintf("Yay! Joining the party on <#%s>", voiceState.ChannelID))
				}

				vc, err := s.ChannelVoiceJoin(guild.ID, voiceState.ChannelID, false, true)
				if err != nil {
					s.ChannelMessageSend(m.ChannelID, "Oops! It seems that I'm not in a mood for singing right now. Please try again later.")
					fmt.Println("[exception] Voice connection error:", err)
					return
				}

				s.ChannelMessageSend(m.ChannelID, fmt.Sprintf("Now playing %s", song.Title))

				dir, err := os.Getwd()
				if err != nil {
					fmt.Println("[exception] Get working directory error:", err)
					return
				}

				song.streamNow(vc, dir+"/songs/song.mp3")
			}
		}
	}

	queue.Lock = false
}

func playSongCommand(bot *Bot, s *discordgo.Session, m *discordgo.MessageCreate, args []string) {
	if len(m.Content) == 0 {
		s.ChannelMessageSendReply(m.ChannelID, "Guess you forgot to provide a song name", m.Reference())
		return
	}

	// TODO: search for a song on youtube and handle the response properly

	song := &Song{
		Title:       m.Content,
		RequestedBy: m.Author.ID,
		Position:    len(bot.Queue.Songs) + 1,
		Url:         "",
		StreamUrl:   "",
		ArtworkUrl:  "",
		Duration:    "",
	}

	bot.Queue.add(*song)
	bot.Queue.process(s, m)
}

func pingCommand(bot *Bot, s *discordgo.Session, m *discordgo.MessageCreate, args []string) {
	s.ChannelMessageSendReply(m.ChannelID, "Pong!", m.Reference())
}

func (bot *Bot) onMessageInteractionCreate(s *discordgo.Session, m *discordgo.MessageCreate) {
	if m.Author.Bot || !strings.HasPrefix(m.Content, bot.CommandPrefix) {
		return
	}

	maybeCommand := strings.TrimLeft(m.Content, bot.CommandPrefix)
	if len(maybeCommand) == 0 {
		s.ChannelMessageSend(m.ChannelID, "Provided an invalid command")
		return
	}

	commands := []Command{
		{
			Name:    "ping",
			Execute: pingCommand,
		},
		{
			Name:    "play",
			Execute: playSongCommand,
		},
	}

	c := strings.Split(maybeCommand, " ")
	commandRef := c[0]
	commandArgs := c[1:]
	m.Content = strings.TrimLeft(maybeCommand, commandRef)

	for _, command := range commands {
		if commandRef == command.Name {
			command.Execute(bot, s, m, commandArgs)
			return
		}
	}
}

func main() {
	bot := Bot{
		Token:         "NzY0NzQxODA4NTg0MjYxNjUy.GpGXj0.mCfntxocMWyxpBLHFcgbmqICb9UgSU5o_B7Vkw",
		CommandPrefix: "+",
		Session:       nil,
		Queue: &Queue{
			Lock:  false,
			Songs: []Song{},
		},
	}

	ds, err := discordgo.New("Bot " + bot.Token)
	if err != nil {
		panic(fmt.Sprintf("[fatal] Discord session error: %s", err))
	}

	bot.Session = ds
	bot.Session.AddHandler(bot.onMessageInteractionCreate)

	err = bot.Session.Open()
	if err != nil {
		panic(fmt.Sprintf("[fatal] Websocket open error: %s", err))
	}

	fmt.Println("[info] Bot started and ready to listen interactions")
	fmt.Println("[info] Press CTRL-C to shutdown the bot and exit")

	sc := make(chan os.Signal, 1)
	signal.Notify(sc, syscall.SIGINT, syscall.SIGTERM, os.Interrupt)
	<-sc

	if err := bot.Session.Close(); err != nil {
		panic(fmt.Sprintf("[fatal] Websocket close error: %s", err))
	}
}
