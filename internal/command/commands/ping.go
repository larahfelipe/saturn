package commands

import (
	"github.com/larahfelipe/saturn/internal/bot"
	"github.com/larahfelipe/saturn/internal/command"
)

type PingCommand struct {
	*command.BaseCommand
}

func NewPingCommand() *PingCommand {
	return &PingCommand{
		BaseCommand: command.NewBaseCommand("ping", "Ping the bot", true),
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

func (pc *PingCommand) Execute(bot *bot.Bot, m *command.Message) {
	bot.Session.ChannelMessageSendReply(m.ChannelID, "Pong!", m.Reference())
}
