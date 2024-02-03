package command

import (
	"fmt"
	"strings"

	"github.com/bwmarrin/discordgo"
	"github.com/larahfelipe/saturn/internal/bot"
)

type Message struct {
	*discordgo.MessageCreate
	Args []string
}

type ExecutableCommand struct {
	Active  bool
	Name    string
	Help    string
	Execute func(s *discordgo.Session, m *Message)
}

type Command struct {
	Prefix string
	Bot    *bot.Bot
}

func New(prefix string) (*Command, error) {
	if len(prefix) == 0 {
		return nil, fmt.Errorf("prefix cannot be empty")
	}

	return &Command{
		Prefix: prefix,
	}, nil
}

func (c *Command) getAll() []ExecutableCommand {
	return []ExecutableCommand{
		{
			Active:  true,
			Name:    "ping",
			Help:    "Pong!",
			Execute: pingCommand,
		},
		{
			Active:  true,
			Name:    "health",
			Help:    "Check bot health",
			Execute: healthCommand,
		},
		{
			Active:  true,
			Name:    "help",
			Help:    "Show available commands",
			Execute: helpCommand,
		},
		{
			Active:  true,
			Name:    "play",
			Help:    "Play a song from YouTube using a valid URL",
			Execute: playSongCommand,
		},
		{
			Active:  true,
			Name:    "skip",
			Help:    "Skip the current song",
			Execute: skipSongCommand,
		},
		{
			Active:  true,
			Name:    "pause",
			Help:    "Pause the current song",
			Execute: pauseSongCommand,
		},
		{
			Active:  true,
			Name:    "unpause",
			Help:    "Unpause the current song",
			Execute: unpauseSongCommand,
		},
		{
			Active:  true,
			Name:    "stop",
			Help:    "Stop the current song",
			Execute: stopSongCommand,
		},
	}
}

func (c *Command) Handle(s *discordgo.Session, m *discordgo.MessageCreate) error {
	mc := strings.Split(m.Content, " ")
	maybeCommandName := mc[0]
	maybeCommandArgs := mc[1:]

	for _, command := range c.getAll() {
		if maybeCommandName == command.Name && command.Active {
			command.Execute(s, &Message{m, maybeCommandArgs})
			return nil
		}
	}

	return fmt.Errorf("unknown or unavailable command `%s` triggered with args `%v`", maybeCommandName, maybeCommandArgs)
}
