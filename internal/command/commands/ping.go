package commands

import (
	dg "github.com/bwmarrin/discordgo"
	"github.com/larahfelipe/saturn/internal/command"
	"github.com/larahfelipe/saturn/internal/discord"
)

// Ping constructs the ping command handler.
func Ping(bot *discord.Bot) command.HandlerFunc {
	return func(s *dg.Session, i *dg.InteractionCreate) error {
		bot.RespondText(i.Interaction, "Pong! 🏓")
		return nil
	}
}
