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
	return func(s *dg.Session, i *dg.InteractionCreate) error {
		var list []string
		for _, cmd := range router.Commands() {
			if cmd.Active {
				list = append(list, fmt.Sprintf("`/%s` - %s", cmd.ApplicationCommand.Name, cmd.ApplicationCommand.Description))
			}
		}

		content := "Available slash commands:\n" + strings.Join(list, "\n")
		bot.RespondEmbed(i.Interaction, bot.BuildMessageEmbed(content))
		return nil
	}
}
