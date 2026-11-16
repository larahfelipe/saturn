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

// Prepare registers the command router handler and message components listener.
func (bot *Bot) Prepare(router *command.Router, registry *player.Registry) {
	bot.Session.AddHandler(func(s *dg.Session, i *dg.InteractionCreate) {
		switch i.Type {
		case dg.InteractionApplicationCommand:
			if err := router.Process(s, i); err != nil {
				bot.Logger.Error("command interaction error", zap.Error(err), zap.String("command", i.ApplicationCommandData().Name))
			}
		case dg.InteractionMessageComponent:
			bot.handleComponent(s, i, registry)
		}
	})
}

// handleComponent routes action clicks from buttons to their targeted player instances.
func (bot *Bot) handleComponent(s *dg.Session, i *dg.InteractionCreate, registry *player.Registry) {
	customID := i.MessageComponentData().CustomID
	parts := strings.Split(customID, "_")
	if len(parts) < 2 {
		return
	}

	action, guildID := parts[0], parts[1]
	queue := registry.Get(guildID)

	var content string
	var success bool

	switch action {
	case "pause":
		success = queue.Pause()
		content = "Playback paused ⏸️"
	case "unpause":
		success = queue.Unpause()
		content = "Playback resumed ▶️"
	case "skip":
		success = queue.Skip()
		content = "Song skipped ⏭️"
	case "stop":
		success = queue.Stop()
		content = "Playback stopped 🛑"
	}

	if !success {
		content = "Command could not be completed (player might be idle)"
	}

	err := s.InteractionRespond(i.Interaction, &dg.InteractionResponse{
		Type: dg.InteractionResponseChannelMessageWithSource,
		Data: &dg.InteractionResponseData{
			Content: content,
			Flags:   dg.MessageFlagsEphemeral,
		},
	})
	if err != nil {
		bot.Logger.Error("failed to respond to button component", zap.Error(err))
	}
}

// Run starts the bot connection gateway and registers application commands.
func (bot *Bot) Run(router *command.Router) {
	startTime := time.Now()

	// Intents: no longer requires Message Content or Message events!
	bot.Session.Identify.Intents = dg.IntentsGuilds |
		dg.IntentsGuildVoiceStates

	if err := bot.Session.Open(); err != nil {
		bot.Logger.Fatal("discord websocket connection error", zap.Error(err))
	}
	defer func() {
		if err := bot.Session.Close(); err != nil {
			bot.Logger.Fatal("discord websocket disconnection error", zap.Error(err))
		}
		bot.Logger.Info("app stopped", zap.String("uptime", time.Since(startTime).String()))
	}()

	bot.Logger.Info("registering application slash commands...")
	for _, cmd := range router.Commands() {
		if cmd.Active {
			_, err := bot.Session.ApplicationCommandCreate(bot.Session.State.User.ID, "", cmd.ApplicationCommand)
			if err != nil {
				bot.Logger.Error("failed to register slash command", zap.String("name", cmd.ApplicationCommand.Name), zap.Error(err))
			} else {
				bot.Logger.Info("registered command", zap.String("name", cmd.ApplicationCommand.Name))
			}
		}
	}

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

// RespondText responds to an interaction with simple text.
func (bot *Bot) RespondText(i *dg.Interaction, content string) {
	err := bot.Session.InteractionRespond(i, &dg.InteractionResponse{
		Type: dg.InteractionResponseChannelMessageWithSource,
		Data: &dg.InteractionResponseData{
			Content: content,
		},
	})
	if err != nil {
		bot.Logger.Error("failed to respond text to interaction", zap.Error(err))
	}
}

// RespondEmbed responds to an interaction with an embed message.
func (bot *Bot) RespondEmbed(i *dg.Interaction, embed *dg.MessageEmbed) {
	err := bot.Session.InteractionRespond(i, &dg.InteractionResponse{
		Type: dg.InteractionResponseChannelMessageWithSource,
		Data: &dg.InteractionResponseData{
			Embeds: []*dg.MessageEmbed{embed},
		},
	})
	if err != nil {
		bot.Logger.Error("failed to respond embed to interaction", zap.Error(err))
	}
}

// RespondEmbedWithButtons responds to an interaction with an embed and control buttons.
func (bot *Bot) RespondEmbedWithButtons(i *dg.Interaction, embed *dg.MessageEmbed) {
	err := bot.Session.InteractionRespond(i, &dg.InteractionResponse{
		Type: dg.InteractionResponseChannelMessageWithSource,
		Data: &dg.InteractionResponseData{
			Embeds: []*dg.MessageEmbed{embed},
			Components: []dg.MessageComponent{
				dg.ActionsRow{
					Components: []dg.MessageComponent{
						dg.Button{
							Label:    "Pause",
							Style:    dg.SecondaryButton,
							CustomID: "pause_" + i.GuildID,
							Emoji:    &dg.ComponentEmoji{Name: "⏸️"},
						},
						dg.Button{
							Label:    "Resume",
							Style:    dg.SuccessButton,
							CustomID: "unpause_" + i.GuildID,
							Emoji:    &dg.ComponentEmoji{Name: "▶️"},
						},
						dg.Button{
							Label:    "Skip",
							Style:    dg.PrimaryButton,
							CustomID: "skip_" + i.GuildID,
							Emoji:    &dg.ComponentEmoji{Name: "⏭️"},
						},
						dg.Button{
							Label:    "Stop",
							Style:    dg.DangerButton,
							CustomID: "stop_" + i.GuildID,
							Emoji:    &dg.ComponentEmoji{Name: "🛑"},
						},
					},
				},
			},
		},
	})
	if err != nil {
		bot.Logger.Error("failed to respond embed with buttons to interaction", zap.Error(err))
	}
}

// FollowupError edits a deferred response with an error embed.
func (bot *Bot) FollowupError(i *dg.Interaction, content string) {
	embed := bot.BuildErrorMessageEmbed(content)
	_, err := bot.Session.InteractionResponseEdit(i, &dg.WebhookEdit{
		Embeds: &[]*dg.MessageEmbed{embed},
	})
	if err != nil {
		bot.Logger.Error("failed to send followup error to interaction", zap.Error(err))
	}
}

// FollowupEmbedWithButtons edits a deferred response with a song embed and control buttons.
func (bot *Bot) FollowupEmbedWithButtons(i *dg.Interaction, embed *dg.MessageEmbed) {
	_, err := bot.Session.InteractionResponseEdit(i, &dg.WebhookEdit{
		Embeds: &[]*dg.MessageEmbed{embed},
		Components: &[]dg.MessageComponent{
			dg.ActionsRow{
				Components: []dg.MessageComponent{
					dg.Button{
						Label:    "Pause",
						Style:    dg.SecondaryButton,
						CustomID: "pause_" + i.GuildID,
						Emoji:    &dg.ComponentEmoji{Name: "⏸️"},
					},
					dg.Button{
						Label:    "Resume",
						Style:    dg.SuccessButton,
						CustomID: "unpause_" + i.GuildID,
						Emoji:    &dg.ComponentEmoji{Name: "▶️"},
					},
					dg.Button{
						Label:    "Skip",
						Style:    dg.PrimaryButton,
						CustomID: "skip_" + i.GuildID,
						Emoji:    &dg.ComponentEmoji{Name: "⏭️"},
					},
					dg.Button{
						Label:    "Stop",
						Style:    dg.DangerButton,
						CustomID: "stop_" + i.GuildID,
						Emoji:    &dg.ComponentEmoji{Name: "🛑"},
					},
				},
			},
		},
	})
	if err != nil {
		bot.Logger.Error("failed to send followup embed with buttons", zap.Error(err))
	}
}
