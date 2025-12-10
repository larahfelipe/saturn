package commands

import (
	"github.com/larahfelipe/saturn/internal/bot"
	"github.com/larahfelipe/saturn/internal/command"
)

type PingCommand struct {
	*command.BaseCommand
	Bot *bot.Bot
}

func NewPingCommand(bot *bot.Bot) *PingCommand {
	return &PingCommand{
		BaseCommand: command.NewBaseCommand("ping", "Ping the bot", true),
		Bot:         bot,
	}
}

func (pc *PingCommand) Active() bool {
	return pc.BaseCommand.Active
}

func (pc *PingCommand) Name() string {
	return pc.BaseCommand.Name
}

func (pc *PingCommand) Help() string {
	return pc.BaseCommand.Help
}

func (pc *PingCommand) Execute(m *command.Message) error {
	pc.Bot.DS.SendReplyMessage(m.Message, "Pong!")
	return nil
}
