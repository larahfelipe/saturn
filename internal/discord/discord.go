package discord

import (
	"strings"
	"time"

	dg "github.com/bwmarrin/discordgo"
	"github.com/larahfelipe/saturn/internal/common"
	"go.uber.org/zap"
)

type Callback func(s *dg.Session, m *dg.MessageCreate) error

// CommandMessageCreateHandler handles the message interaction.
func (d *Discord) CommandMessageCreateHandler(callback Callback, prefix string) {
	d.Session.AddHandler(func(s *dg.Session, m *dg.MessageCreate) {
		if m.Author.Bot || !strings.HasPrefix(m.Content, prefix) {
			return
		}

		maybeCommand := strings.TrimPrefix(m.Content, prefix)
		if len(maybeCommand) == 0 {
			zap.L().Error("missing command name", zap.String("author", m.Author.Username))
			return
		}

		m.Content = maybeCommand

		if err := callback(s, m); err != nil {
			zap.L().Error("runtime error", zap.Error(err), zap.String("interaction", m.Content), zap.String("author", m.Author.Username))
		}
	})
}

// BuildErrorMessageEmbed builds an embed error message with the given message.
func (d *Discord) BuildErrorMessageEmbed(content string) *dg.MessageEmbed {
	return &dg.MessageEmbed{
		Author: &dg.MessageEmbedAuthor{
			Name:    "❌ Oops, a wild error appeared! 😱",
			IconURL: d.Session.State.User.AvatarURL("256"),
		},
		Description: content,
		Footer: &dg.MessageEmbedFooter{
			Text: "Please try again later",
		},
		Timestamp: time.Now().Format(time.RFC3339),
		Color:     0xFB3640,
	}
}

// BuildMessageEmbed builds an embed message with the given message.
func (d *Discord) BuildMessageEmbed(content string) *dg.MessageEmbed {
	return &dg.MessageEmbed{
		Author: &dg.MessageEmbedAuthor{
			Name:    d.Session.State.User.Username,
			IconURL: d.Session.State.User.AvatarURL("256"),
		},
		Description: content,
		Footer: &dg.MessageEmbedFooter{
			Text: "From space",
		},
		Timestamp: time.Now().Format(time.RFC3339),
		Color:     0x6E76E5,
	}
}

// SendMessageEmbed sends an embed message to a channel.
func (d *Discord) SendMessageEmbed(m *dg.Message, content *dg.MessageEmbed) {
	if _, err := d.Session.ChannelMessageSendEmbed(m.ChannelID, content); err != nil {
		zap.L().Error("failed to send message", zap.Error(err))
	}
}

// SendReplyMessage sends an message to a channel as a reply.
func (d *Discord) SendReplyMessage(m *dg.Message, content string) {
	if _, err := d.Session.ChannelMessageSendReply(m.ChannelID, content, m.Reference()); err != nil {
		zap.L().Error("failed to send message reply", zap.Error(err))
	}
}

// SendReplyMessageEmbed sends an embed message to a channel as a reply.
func (d *Discord) SendReplyMessageEmbed(m *dg.Message, content *dg.MessageEmbed) {
	if _, err := d.Session.ChannelMessageSendEmbedReply(m.ChannelID, content, m.Reference()); err != nil {
		zap.L().Error("failed to send message reply", zap.Error(err))
	}
}

// AddMessageReaction adds a reaction to a message.
func (d *Discord) AddMessageReaction(m *dg.Message, content string) {
	if err := d.Session.MessageReactionAdd(m.ChannelID, m.ID, content); err != nil {
		zap.L().Error("failed to add message reaction", zap.Error(err))
	}
}

// GetVoiceChannelByUserId gets the voice channel based on the given user id.
func (d *Discord) GetVoiceChannelByUserId(userId string) (*dg.Channel, error) {
	for _, guild := range d.Session.State.Guilds {
		for _, voiceState := range guild.VoiceStates {
			if voiceState.UserID == userId {
				voiceChannel, err := d.Session.Channel(voiceState.ChannelID)
				if err != nil {
					return nil, err
				}

				return voiceChannel, nil
			}
		}
	}

	return nil, common.ErrUnknownVoiceChannel
}
