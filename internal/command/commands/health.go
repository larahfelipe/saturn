package commands

import (
	"fmt"

	dg "github.com/bwmarrin/discordgo"
	"github.com/larahfelipe/saturn/internal/command"
	"github.com/larahfelipe/saturn/internal/discord"
)

// Health constructs the health command handler.
func Health(bot *discord.Bot) command.HandlerFunc {
	return func(s *dg.Session, i *dg.InteractionCreate) error {
		latencyMs := bot.Session.HeartbeatLatency().Milliseconds()
		bot.RespondEmbed(i.Interaction, bot.BuildMessageEmbed(fmt.Sprintf("Heartbeat latency: %dms", latencyMs)))
		return nil
	}
}
