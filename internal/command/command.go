package command

import (
	"errors"
	"strings"

	dg "github.com/bwmarrin/discordgo"
)

var (
	ErrUnknownOrUnavailableCommand = errors.New("triggered an unknown or unavailable command")
	ErrMissingDiscordBotPrefix     = errors.New("missing bot command prefix")
)

// HandlerFunc is the signature of functional command handlers.
type HandlerFunc func(s *dg.Session, m *dg.MessageCreate, args []string) error

// Command configuration structure.
type Command struct {
	Name        string
	Description string
	Active      bool
	Run         HandlerFunc
}

// Router manages command routing based on message prefix matching.
type Router struct {
	prefix   string
	commands map[string]Command
}

// NewRouter instantiates a new Router.
func NewRouter(prefix string) (*Router, error) {
	if len(prefix) == 0 {
		return nil, ErrMissingDiscordBotPrefix
	}
	return &Router{
		prefix:   prefix,
		commands: make(map[string]Command),
	}, nil
}

// Register adds a command configuration to the routing table.
func (r *Router) Register(cmd Command) {
	r.commands[cmd.Name] = cmd
}

// Process parses and routes the message payload.
func (r *Router) Process(s *dg.Session, m *dg.MessageCreate) error {
	content := strings.Split(m.Content, " ")
	maybeCommandName := content[0]
	var maybeCommandArgs []string
	if len(content) > 1 {
		maybeCommandArgs = content[1:]
	}

	cmd, exists := r.commands[maybeCommandName]
	if !exists || !cmd.Active {
		return ErrUnknownOrUnavailableCommand
	}

	return cmd.Run(s, m, maybeCommandArgs)
}

// Commands returns the mapping of registered command configs.
func (r *Router) Commands() map[string]Command {
	return r.commands
}
