package command

import (
	"errors"

	dg "github.com/bwmarrin/discordgo"
	"github.com/larahfelipe/saturn/internal/metrics"
)

var (
	ErrUnknownOrUnavailableCommand = errors.New("triggered an unknown or unavailable command")
)

// HandlerFunc is the signature of functional interaction handlers for slash commands.
type HandlerFunc func(s *dg.Session, i *dg.InteractionCreate) error

// Command represents a Discord application slash command wrapper.
type Command struct {
	ApplicationCommand *dg.ApplicationCommand
	Active             bool
	Run                HandlerFunc
}

// Router manages slash command routing.
type Router struct {
	commands map[string]Command
}

// NewRouter instantiates a new Router.
func NewRouter() *Router {
	return &Router{
		commands: make(map[string]Command),
	}
}

// Register adds a command configuration to the routing table.
func (r *Router) Register(cmd Command) {
	r.commands[cmd.ApplicationCommand.Name] = cmd
}

// Process parses and routes the interaction payload.
func (r *Router) Process(s *dg.Session, i *dg.InteractionCreate) error {
	if i.Type != dg.InteractionApplicationCommand {
		return nil
	}

	cmdName := i.ApplicationCommandData().Name
	cmd, exists := r.commands[cmdName]
	if !exists || !cmd.Active {
		return ErrUnknownOrUnavailableCommand
	}

	metrics.CommandsProcessed.WithLabelValues(cmdName).Inc()

	return cmd.Run(s, i)
}

// Commands returns the mapping of registered command configs.
func (r *Router) Commands() map[string]Command {
	return r.commands
}
