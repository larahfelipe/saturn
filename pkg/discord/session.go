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

func NewService(token string) (*DiscordService, error) {
	ds, err := discordgo.New("Bot " + token)
	if err != nil {
		return nil, err
	}

	return &DiscordService{Session: ds}, nil
}

func (ds *DiscordService) CommandMessageCreateHandler(callback CallbackHandler, prefix string) {
	ds.Session.AddHandler(func(s *discordgo.Session, m *discordgo.MessageCreate) {
		if m.Author.Bot || !strings.HasPrefix(m.Content, prefix) {
			return
		}

		maybeCommand := strings.TrimLeft(m.Content, prefix)
		if len(maybeCommand) == 0 {
			zap.L().Error("missing command reference", zap.String("author", m.Author.Username))
			return
		}

		m.Content = maybeCommand

		if err := callback(s, m); err != nil {
			zap.L().Error("command execution failed", zap.Error(err), zap.String("author", m.Author.Username))
		}
	})
}

func (ds *DiscordService) Connect() error {
	if err := ds.Session.Open(); err != nil {
		return err
	}

	return nil
}

func (ds *DiscordService) Disconnect() error {
	if err := ds.Session.Close(); err != nil {
		return err
	}

	return nil
}
