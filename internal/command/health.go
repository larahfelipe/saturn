package command

import (
	"fmt"

	"github.com/bwmarrin/discordgo"
	"github.com/larahfelipe/saturn/internal/command"
)

func healthCommand(s *discordgo.Session, m *command.Message) {
	latencyMs := s.HeartbeatLatency().Milliseconds()
	s.ChannelMessageSendEmbed(m.ChannelID, bot.ChannelMessageEmbedSend(fmt.Sprintf("Heartbeat latency: %dms", latencyMs)))
}
