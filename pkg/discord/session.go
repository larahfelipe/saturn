package discord

import (
	"strings"

	"github.com/bwmarrin/discordgo"
	"go.uber.org/zap"
)

type DiscordService struct {
	Session *discordgo.Session
}

type CallbackHandler func(s *discordgo.Session, m *discordgo.MessageCreate) error

// NewService creates a new discord service instance.
func NewService(token string) (*DiscordService, error) {
	ds, err := discordgo.New("Bot " + token)
	if err != nil {
		return nil, err
	}

	return &DiscordService{Session: ds}, nil
}

// CommandMessageCreateHandler handles the message interaction.
func (ds *DiscordService) CommandMessageCreateHandler(callback CallbackHandler, prefix string) {
	ds.Session.AddHandler(func(s *discordgo.Session, m *discordgo.MessageCreate) {
		if m.Author.Bot || !strings.HasPrefix(m.Content, prefix) {
			return
		}

		command := strings.TrimPrefix(m.Content, prefix)
		if len(command) == 0 {
			zap.L().Error("missing command reference", zap.String("author", m.Author.Username))
			return
		}

		m.Content = command

		if err := callback(s, m); err != nil {
			zap.L().Error("command runtime exception", zap.Error(err), zap.String("interaction", m.Content), zap.String("author", m.Author.Username))
		}
	})
}

// Connect creates a websocket connection to Discord.
func (ds *DiscordService) Connect() error {
	if err := ds.Session.Open(); err != nil {
		return err
	}

	return nil
}

// Disconnect closes a websocket connection to Discord.
func (ds *DiscordService) Disconnect() error {
	if err := ds.Session.Close(); err != nil {
		return err
	}

	return nil
}
