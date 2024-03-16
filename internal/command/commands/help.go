package commands

import (
	"github.com/larahfelipe/saturn/internal/bot"
	"github.com/larahfelipe/saturn/internal/command"
)

type HelpCommand struct {
	*command.BaseCommand
}

func NewHelpCommand() *HelpCommand {
	return &HelpCommand{
		BaseCommand: command.NewBaseCommand("help", "Show available commands", false),
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

func (hc *HelpCommand) Execute(bot *bot.Bot, m *command.Message) error {
	bot.Session.ChannelMessageSendEmbed(m.ChannelID, bot.BuildMessageEmbed("Help command"))
	// activeCommands := []string{}
	// for _, command := range hc.GetAll() {
	// 	if command.Active {
	// 		activeCommands = append(activeCommands, fmt.Sprintf("**%s%s**: %s", c.Prefix, command.Name, command.Help))
	// 	}
	// }

	// bot.Session.ChannelMessageSendEmbedReply(m.ChannelID, bot.BuildMessageEmbed(strings.Join(activeCommands, "\n")), m.Reference())

	return nil
}
