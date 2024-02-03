package command

import (
	"fmt"
	"strings"

	"github.com/larahfelipe/saturn/internal/bot"
)

func helpCommand(bot *bot.Bot, m *bot.Message) {
	activeCommands := []string{}
	for _, command := range bot.Command.Callable {
		if command.Active {
			activeCommands = append(activeCommands, fmt.Sprintf("**%s%s**: %s", bot.Command.Prefix, command.Name, command.Help))
		}
	}

	bot.Session.ChannelMessageSendEmbedReply(m.ChannelID, bot.BuildMessageEmbed(strings.Join(activeCommands, "\n")), m.Reference())
}
