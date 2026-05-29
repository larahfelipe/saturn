package discord

import (
	"errors"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	dg "github.com/bwmarrin/discordgo"
	"github.com/larahfelipe/saturn/internal/command"
	"github.com/larahfelipe/saturn/internal/config"
	"github.com/larahfelipe/saturn/internal/player"
	"go.uber.org/zap"
)

var (
	ErrMissingDiscordBotToken = errors.New("missing bot token")
	ErrUnknownVoiceChannel     = errors.New("could not find the message's author voice channel")
)

type Bot struct {
	Config  *config.Config
	Logger  *zap.Logger
	Session *dg.Session
}

// New creates a new Bot instance.
func New(cfg *config.Config, logger *zap.Logger) (*Bot, error) {
	if cfg.BotToken == "" {
		return nil, ErrMissingDiscordBotToken
	}

	s, err := dg.New("Bot " + cfg.BotToken)
	if err != nil {
		return nil, err
	}

	return &Bot{
		Config:  cfg,
		Logger:  logger,
		Session: s,
	}, nil
}

// Prepare registers the command router handler.
func (bot *Bot) Prepare(router *command.Router) {
	bot.Session.AddHandler(func(s *dg.Session, m *dg.MessageCreate) {
		if m.Author.Bot || !strings.HasPrefix(m.Content, bot.Config.BotPrefix) {
			return
		}

		maybeCommand := strings.TrimPrefix(m.Content, bot.Config.BotPrefix)
		if len(maybeCommand) == 0 {
			bot.Logger.Error("missing command name", zap.String("author", m.Author.Username))
			return
		}

		m.Content = maybeCommand

		if err := router.Process(s, m); err != nil {
			bot.Logger.Error("runtime error", zap.Error(err), zap.String("interaction", m.Content), zap.String("author", m.Author.Username))
		}
	})
}

// Run starts the bot connection gateway and waits for system interrupt signals.
func (bot *Bot) Run() {
	startTime := time.Now()

	bot.Session.Identify.Intents = dg.IntentsGuilds |
		dg.IntentsGuildVoiceStates |
		dg.IntentsGuildMessages |
		dg.IntentsMessageContent

	if err := bot.Session.Open(); err != nil {
		bot.Logger.Fatal("discord websocket connection error", zap.Error(err))
	}
	defer func() {
		if err := bot.Session.Close(); err != nil {
			bot.Logger.Fatal("discord websocket disconnection error", zap.Error(err))
		}
		bot.Logger.Info("app stopped", zap.String("uptime", time.Since(startTime).String()))
	}()

	if bot.Config.BotStatus != "" {
		if err := bot.Session.UpdateCustomStatus(bot.Config.BotStatus); err != nil {
			bot.Logger.Error("bot activity status update error", zap.Error(err))
		}
	}

	bot.Logger.Info("bot connected and listening for interactions", zap.String("username", bot.Session.State.User.Username))
	bot.Logger.Info("app started", zap.String("environment", bot.Config.AppEnvironment))

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM, os.Interrupt)
	<-sigChan
}

// JoinVoiceChannel connects the bot to the voice channel of the target user on a specific guild.
func (bot *Bot) JoinVoiceChannel(guildID, userID string) (*player.Voice, error) {
	voiceChannel, err := bot.GetVoiceChannelByGuildAndUser(guildID, userID)
	if err != nil {
		return nil, err
	}

	conn, err := bot.Session.ChannelVoiceJoin(voiceChannel.GuildID, voiceChannel.ID, false, true)
	if err != nil {
		return nil, err
	}

	return &player.Voice{
		Connection: conn,
		Channel:    voiceChannel,
	}, nil
}

// GetVoiceChannelByGuildAndUser queries the cached guild voice state to locate the user channel.
func (bot *Bot) GetVoiceChannelByGuildAndUser(guildID, userID string) (*dg.Channel, error) {
	guild, err := bot.Session.State.Guild(guildID)
	if err != nil {
		return nil, err
	}

	for _, voiceState := range guild.VoiceStates {
		if voiceState.UserID == userID {
			voiceChannel, err := bot.Session.Channel(voiceState.ChannelID)
			if err != nil {
				return nil, err
			}

			return voiceChannel, nil
		}
	}

	return nil, ErrUnknownVoiceChannel
}

// BuildErrorMessageEmbed builds a standard Discord error layout.
func (bot *Bot) BuildErrorMessageEmbed(content string) *dg.MessageEmbed {
	return &dg.MessageEmbed{
		Author: &dg.MessageEmbedAuthor{
			Name:    "❌ Oops, a wild error appeared! 😱",
			IconURL: bot.Session.State.User.AvatarURL("256"),
		},
		Description: content,
		Footer: &dg.MessageEmbedFooter{
			Text: "Please try again later",
		},
		Timestamp: time.Now().Format(time.RFC3339),
		Color:     0xFB3640,
	}
}

// BuildMessageEmbed builds a standard Discord message layout.
func (bot *Bot) BuildMessageEmbed(content string) *dg.MessageEmbed {
	return &dg.MessageEmbed{
		Author: &dg.MessageEmbedAuthor{
			Name:    bot.Session.State.User.Username,
			IconURL: bot.Session.State.User.AvatarURL("256"),
		},
		Description: content,
		Footer: &dg.MessageEmbedFooter{
			Text: "From space",
		},
		Timestamp: time.Now().Format(time.RFC3339),
		Color:     0x6E76E5,
	}
}

// SendMessageEmbed transmits an embed block to a channel.
func (bot *Bot) SendMessageEmbed(m *dg.Message, content *dg.MessageEmbed) {
	if _, err := bot.Session.ChannelMessageSendEmbed(m.ChannelID, content); err != nil {
		bot.Logger.Error("failed to send message", zap.Error(err))
	}
}

// SendReplyMessage sends a plain text response as a reply.
func (bot *Bot) SendReplyMessage(m *dg.Message, content string) {
	if _, err := bot.Session.ChannelMessageSendReply(m.ChannelID, content, m.Reference()); err != nil {
		bot.Logger.Error("failed to send message reply", zap.Error(err))
	}
}

// SendReplyMessageEmbed sends an embed response as a reply.
func (bot *Bot) SendReplyMessageEmbed(m *dg.Message, content *dg.MessageEmbed) {
	if _, err := bot.Session.ChannelMessageSendEmbedReply(m.ChannelID, content, m.Reference()); err != nil {
		bot.Logger.Error("failed to send message reply", zap.Error(err))
	}
}

// AddMessageReaction appends a reaction emoji to a message.
func (bot *Bot) AddMessageReaction(m *dg.Message, content string) {
	if err := bot.Session.MessageReactionAdd(m.ChannelID, m.ID, content); err != nil {
		bot.Logger.Error("failed to add message reaction", zap.Error(err))
	}
}
