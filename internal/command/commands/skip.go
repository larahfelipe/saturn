package commands

import (
	dg "github.com/bwmarrin/discordgo"
	"github.com/larahfelipe/saturn/internal/command"
	"github.com/larahfelipe/saturn/internal/discord"
	"github.com/larahfelipe/saturn/internal/player"
)

// Skip constructs the skip command handler.
func Skip(bot *discord.Bot, registry *player.Registry) command.HandlerFunc {
	return func(s *dg.Session, m *dg.MessageCreate, args []string) error {
		queue := registry.Get(m.GuildID)
		if !queue.Skip() {
			bot.SendReplyMessage(m.Message, "There is no song playing right now")
			return nil
		}

		bot.AddMessageReaction(m.Message, "⏭️")

		return nil
	}
}
