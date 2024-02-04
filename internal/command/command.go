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

type ICommand interface {
	Active() bool
	Name() string
	Help() string
	Execute(bot *bot.Bot, m *Message)
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

func New(prefix string, bot *bot.Bot) (*Command, error) {
	if len(prefix) == 0 {
		return nil, fmt.Errorf("prefix cannot be empty")
	}

	return &Command{
		Prefix:   prefix,
		Bot:      bot,
		Commands: make(map[string]ICommand),
	}, nil
}

func NewBaseCommand(name, help string, active bool) *BaseCommand {
	return &BaseCommand{
		Active: active,
		Name:   name,
		Help:   help,
	}
}

func (c *Command) Load(commands ...ICommand) {
	for _, command := range commands {
		c.Commands[command.Name()] = command
	}
}

func (c *Command) Process(s *discordgo.Session, m *discordgo.MessageCreate) error {
	mc := strings.Split(m.Content, " ")
	maybeCommandName, maybeCommandArgs := mc[0], mc[1:]

	command, exists := c.Commands[maybeCommandName]
	if !exists || !command.Active() {
		return fmt.Errorf("unknown or unavailable command `%s` triggered with args `%v`", maybeCommandName, maybeCommandArgs)
	}

	command.Execute(c.Bot, &Message{m, maybeCommandArgs})

	return nil
}
