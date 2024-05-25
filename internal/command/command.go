package command

import (
	"fmt"
	"strings"

	"github.com/bwmarrin/discordgo"
	"github.com/larahfelipe/saturn/internal/bot"
	"github.com/larahfelipe/saturn/internal/common"
)

type Message struct {
	*discordgo.MessageCreate
	Args []string
}

type ICommand interface {
	Active() bool
	Name() string
	Help() string
	Execute(bot *bot.Bot, m *Message) error
}

type BaseCommand struct {
	Active bool
	Name   string
	Help   string
}

type Command struct {
	Prefix   string
	Bot      *bot.Bot
	Commands map[string]ICommand
}

// New creates a new bot command instance.
func New(prefix string, bot *bot.Bot) (*Command, error) {
	if len(prefix) == 0 {
		return nil, common.ErrMissingDiscordBotPrefix
	}

	return &Command{
		Prefix:   prefix,
		Bot:      bot,
		Commands: make(map[string]ICommand),
	}, nil
}

// NewBaseCommand creates a new bot base command instance.
func NewBaseCommand(name, help string, active bool) *BaseCommand {
	return &BaseCommand{
		Active: active,
		Name:   name,
		Help:   help,
	}
}

// Load loads the given bot commands.
func (c *Command) Load(commands ...ICommand) {
	for _, command := range commands {
		c.Commands[command.Name()] = command
	}
}

// Process handles the command execution.
func (c *Command) Process(s *discordgo.Session, m *discordgo.MessageCreate) error {
	mc := strings.Split(m.Content, " ")
	maybeCommandName, maybeCommandArgs := mc[0], mc[1:]

	command, exists := c.Commands[maybeCommandName]
	if !exists || !command.Active() {
		return fmt.Errorf("unknown or unavailable command `%s` triggered with args `%v`", maybeCommandName, maybeCommandArgs)
	}

	if err := command.Execute(c.Bot, &Message{m, maybeCommandArgs}); err != nil {
		return err
	}

	return nil
}
