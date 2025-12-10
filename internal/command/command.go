package command

import (
	"strings"

	dg "github.com/bwmarrin/discordgo"
	"github.com/larahfelipe/saturn/internal/common"
)

type Message struct {
	*dg.MessageCreate
	Args []string
}

type ICommand interface {
	Active() bool
	Name() string
	Help() string
	Execute(m *Message) error
}

type BaseCommand struct {
	Active bool
	Name   string
	Help   string
}

type Command struct {
	Prefix   string
	Commands map[string]ICommand
}

// New creates a new `Command` record.
func New(prefix string) (*Command, error) {
	if len(prefix) == 0 {
		return nil, common.ErrMissingDiscordBotPrefix
	}

	return &Command{
		Prefix:   prefix,
		Commands: make(map[string]ICommand),
	}, nil
}

// NewBaseCommand creates a new `BaseCommand` record.
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
func (c *Command) Process(s *dg.Session, m *dg.MessageCreate) error {
	content := strings.Split(m.Content, " ")
	maybeCommandName, maybeCommandArgs := content[0], content[1:]

	command, exists := c.Commands[maybeCommandName]
	if !exists || !command.Active() {
		return common.ErrUnknownOrUnavailableCommand
	}
	if err := command.Execute(&Message{m, maybeCommandArgs}); err != nil {
		return err
	}

	return nil
}
