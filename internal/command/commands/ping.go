package commands

import (
	dg "github.com/bwmarrin/discordgo"
	"github.com/larahfelipe/saturn/internal/command"
	"github.com/larahfelipe/saturn/internal/discord"
)

// Ping constructs the ping command handler.
func Ping(bot *discord.Bot) command.HandlerFunc {
	return func(s *dg.Session, m *dg.MessageCreate, args []string) error {
		bot.SendReplyMessage(m.Message, "Pong!")
		return nil
	}
}
