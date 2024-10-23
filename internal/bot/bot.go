package bot

import (
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"

	"go.uber.org/zap"

	"github.com/larahfelipe/saturn/internal/command"
	"github.com/larahfelipe/saturn/internal/common"
	"github.com/larahfelipe/saturn/internal/config"
	"github.com/larahfelipe/saturn/internal/discord"
	"github.com/larahfelipe/saturn/internal/player"
)

type Bot struct {
	Token string
	DS    *discord.Discord
}

var (
	once     sync.Once
	instance *Bot
)

// newBot creates a new `Bot` record.
func newBot(token string) (*Bot, error) {
	if len(token) == 0 {
		return nil, common.ErrMissingDiscordBotToken
	}

	ds, err := discord.New(token)
	if err != nil {
		return nil, err
	}

	return &Bot{
		Token: token,
		DS:    ds,
	}, nil
}

// GetInstance returns the singleton instance of `Bot`.
func GetInstance() *Bot {
	once.Do(func() {
		var err error
		instance, err = newBot(config.GetBotToken())
		if err != nil {
			zap.L().Fatal("bot initialization error", zap.Error(err))
		}
	})

	return instance
}

// Prepare loads commands and registers a message handler to process them.
func (bot *Bot) Prepare(command *command.Command, commands ...command.ICommand) {
	command.Load(commands...)
	bot.DS.CommandMessageCreateHandler(command.Process, command.Prefix)
}

// Run starts the bot by establishing a ws connection to Discord, and waits for shutdown signals.
func (bot *Bot) Run() {
	startTime := time.Now()

	if err := bot.DS.Connect(); err != nil {
		zap.L().Fatal("discord websocket connection error", zap.Error(err))
	}
	defer func() {
		if err := bot.DS.Disconnect(); err != nil {
			zap.L().Fatal("discord websocket disconnection error", zap.Error(err))
		}

		zap.L().Info("app stopped", zap.String("uptime", time.Since(startTime).String()))
	}()

	if len(config.GetBotStatus()) != 0 {
		if err := bot.DS.Session.UpdateCustomStatus(config.GetBotStatus()); err != nil {
			zap.L().Error("bot activity status update error", zap.Error(err))
		}
	}

	zap.S().Infof("bot connected as `%s` and listening for interactions", bot.DS.Session.State.User.Username)
	zap.L().Info("app started", zap.String("environment", config.GetAppEnvironment()))

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM, os.Interrupt)
	<-sigChan
}

// MakeVoiceConnection makes a voice connection to a voice channel.
func (bot *Bot) MakeVoiceConnection(userId string) (*player.Voice, error) {
	voiceChannel, err := bot.DS.GetVoiceChannelByUserId(userId)
	if err != nil {
		return nil, err
	}

	voice := &player.Voice{
		Channel: voiceChannel,
	}
	voice.Connection, err = bot.DS.Session.ChannelVoiceJoin(voiceChannel.GuildID, voiceChannel.ID, false, true)
	if err != nil {
		return nil, err
	}

	return voice, nil
}
