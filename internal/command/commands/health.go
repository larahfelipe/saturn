package commands

import (
	"fmt"

	"github.com/larahfelipe/saturn/internal/bot"
	"github.com/larahfelipe/saturn/internal/command"
)

type HealthCommand struct {
	*command.BaseCommand
}

func NewHealthCommand() *HealthCommand {
	return &HealthCommand{
		BaseCommand: command.NewBaseCommand("health", "Check bot's health", true),
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
	bot := bot.GetInstance()

	latencyMs := bot.DS.Session.HeartbeatLatency().Milliseconds()

	bot.DS.SendMessageEmbed(m.Message, bot.DS.BuildMessageEmbed(fmt.Sprintf("Heartbeat latency: %dms", latencyMs)))

	return nil
}
