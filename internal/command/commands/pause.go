package commands

import (
	dg "github.com/bwmarrin/discordgo"
	"github.com/larahfelipe/saturn/internal/command"
	"github.com/larahfelipe/saturn/internal/discord"
	"github.com/larahfelipe/saturn/internal/player"
)

// Pause constructs the pause command handler.
func Pause(bot *discord.Bot, registry *player.Registry) command.HandlerFunc {
	return func(s *dg.Session, i *dg.InteractionCreate) error {
		queue := registry.Get(i.GuildID)
		if !queue.Pause() {
			bot.RespondText(i.Interaction, "There is no song playing right now")
			return nil
		}

		bot.RespondText(i.Interaction, "Playback paused ⏸️")

		return nil
	}
}
