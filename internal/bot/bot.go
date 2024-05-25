package bot

import (
	"time"

	"github.com/bwmarrin/discordgo"
	"github.com/kkdai/youtube/v2"

	"github.com/larahfelipe/saturn/internal/common"
	"github.com/larahfelipe/saturn/internal/music"
	"github.com/larahfelipe/saturn/pkg/discord"
)

type Core struct {
	Queue *music.Queue
}

type Extension struct {
	Youtube *youtube.Client
}

type Module struct {
	*Core
	*Extension
}

type Bot struct {
	Token  string
	Module *Module
	*discord.DiscordService
}

// New creates a new discord bot instance.
func New(token string, module *Module) (*Bot, error) {
	if len(token) == 0 {
		return nil, common.ErrMissingDiscordBotToken
	}

	ds, err := discord.NewService(token)
	if err != nil {
		return nil, err
	}

	return &Bot{
		Token:          token,
		Module:         module,
		DiscordService: ds,
	}, nil
}

// BuildErrorMessageEmbed builds an embed error message with the given message.
func (bot *Bot) BuildErrorMessageEmbed(message string) *discordgo.MessageEmbed {
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

// BuildMessageEmbed builds an embed message with the given message.
func (bot *Bot) BuildMessageEmbed(message string) *discordgo.MessageEmbed {
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

// MakeVoiceConnection makes a voice connection based on the channel where the message's author is.
func (bot *Bot) MakeVoiceConnection(m *discordgo.MessageCreate) (*music.Voice, error) {
	for _, guild := range bot.Session.State.Guilds {
		for _, vs := range guild.VoiceStates {
			if vs.UserID == m.Author.ID {
				var err error
				mv := &music.Voice{}

				mv.Connection, err = bot.Session.ChannelVoiceJoin(guild.ID, vs.ChannelID, false, true)
				if err != nil {
					return nil, err
				}

				mv.Channel, err = bot.Session.Channel(vs.ChannelID)
				if err != nil {
					return nil, err
				}

				return mv, nil
			}
		}
	}

	return nil, common.ErrUnknownVoiceChannel
}
