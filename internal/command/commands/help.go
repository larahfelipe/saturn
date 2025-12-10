package commands

import (
	"github.com/larahfelipe/saturn/internal/bot"
	"github.com/larahfelipe/saturn/internal/command"
)

type HelpCommand struct {
	*command.BaseCommand
	Bot *bot.Bot
}

func NewHelpCommand(bot *bot.Bot) *HelpCommand {
	return &HelpCommand{
		BaseCommand: command.NewBaseCommand("help", "Show available commands", false),
		Bot:         bot,
	}
}

func (hc *HelpCommand) Active() bool {
	return hc.BaseCommand.Active
}

func (hc *HelpCommand) Name() string {
	return hc.BaseCommand.Name
}

func (hc *HelpCommand) Help() string {
	return hc.BaseCommand.Help
}

func (hc *HelpCommand) Execute(m *command.Message) error {
	hc.Bot.DS.SendMessageEmbed(m.Message, hc.Bot.DS.BuildMessageEmbed("Help command"))
	return nil
}
