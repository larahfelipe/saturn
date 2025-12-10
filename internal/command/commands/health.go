package commands

import (
	"fmt"

	"github.com/larahfelipe/saturn/internal/bot"
	"github.com/larahfelipe/saturn/internal/command"
)

type HealthCommand struct {
	*command.BaseCommand
	Bot *bot.Bot
}

func NewHealthCommand(bot *bot.Bot) *HealthCommand {
	return &HealthCommand{
		BaseCommand: command.NewBaseCommand("health", "Check bot's health", true),
		Bot:         bot,
	}
}

func (hc *HealthCommand) Active() bool {
	return hc.BaseCommand.Active
}

func (hc *HealthCommand) Name() string {
	return hc.BaseCommand.Name
}

func (hc *HealthCommand) Help() string {
	return hc.BaseCommand.Help
}

func (hc *HealthCommand) Execute(m *command.Message) error {
	latencyMs := hc.Bot.DS.Session.HeartbeatLatency().Milliseconds()
	hc.Bot.DS.SendMessageEmbed(m.Message, hc.Bot.DS.BuildMessageEmbed(fmt.Sprintf("Heartbeat latency: %dms", latencyMs)))

	return nil
}
