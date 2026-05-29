package commands

import (
	"fmt"
	"strings"

	dg "github.com/bwmarrin/discordgo"
	"github.com/larahfelipe/saturn/internal/command"
	"github.com/larahfelipe/saturn/internal/discord"
)

// Help constructs the help command handler.
func Help(bot *discord.Bot, router *command.Router) command.HandlerFunc {
	return func(s *dg.Session, m *dg.MessageCreate, args []string) error {
		var list []string
		for _, cmd := range router.Commands() {
			if cmd.Active {
				list = append(list, fmt.Sprintf("`%s%s` - %s", bot.Config.BotPrefix, cmd.Name, cmd.Description))
			}
		}

		content := "Available commands:\n" + strings.Join(list, "\n")
		bot.SendMessageEmbed(m.Message, bot.BuildMessageEmbed(content))
		return nil
	}
}
