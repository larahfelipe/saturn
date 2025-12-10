package bot

import (
	"os"
	"os/signal"
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
	Config *config.Config
	Logger *zap.Logger
	DS     *discord.Discord
}

// New creates a new `Bot` instance.
func New(cfg *config.Config, logger *zap.Logger) (*Bot, error) {
	if cfg.BotToken == "" {
		return nil, common.ErrMissingDiscordBotToken
	}

	ds, err := discord.New(cfg.BotToken)
	if err != nil {
		return nil, err
	}

	return &Bot{
		Config: cfg,
		Logger: logger,
		DS:     ds,
	}, nil
}

// Prepare loads commands and registers a message handler to process them.
func (bot *Bot) Prepare(command *command.Command, commands ...command.ICommand) {
	command.Load(commands...)
	bot.DS.CommandMessageCreateHandler(command.Process, bot.Config.BotPrefix)
}

// Run starts the bot by establishing a ws connection to Discord, and waits for shutdown signals.
func (bot *Bot) Run() {
	startTime := time.Now()

	if err := bot.DS.Connect(); err != nil {
		bot.Logger.Fatal("discord websocket connection error", zap.Error(err))
	}
	defer func() {
		if err := bot.DS.Disconnect(); err != nil {
			bot.Logger.Fatal("discord websocket disconnection error", zap.Error(err))
		}

		bot.Logger.Info("app stopped", zap.String("uptime", time.Since(startTime).String()))
	}()

	if bot.Config.BotStatus != "" {
		if err := bot.DS.Session.UpdateCustomStatus(bot.Config.BotStatus); err != nil {
			bot.Logger.Error("bot activity status update error", zap.Error(err))
		}
	}

	zap.S().Infof("bot connected as `%s` and listening for interactions", bot.DS.Session.State.User.Username)
	bot.Logger.Info("app started", zap.String("environment", bot.Config.AppEnvironment))

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
