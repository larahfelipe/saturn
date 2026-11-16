package command_test

import (
	"errors"
	"testing"

	dg "github.com/bwmarrin/discordgo"
	"github.com/larahfelipe/saturn/internal/command"
)

func TestRouterProcess(t *testing.T) {
	router := command.NewRouter()

	var called bool
	router.Register(command.Command{
		ApplicationCommand: &dg.ApplicationCommand{
			Name:        "play",
			Description: "Play song",
		},
		Active: true,
		Run: func(s *dg.Session, i *dg.InteractionCreate) error {
			called = true
			return nil
		},
	})

	interaction := &dg.InteractionCreate{
		Interaction: &dg.Interaction{
			Type: dg.InteractionApplicationCommand,
			Data: dg.ApplicationCommandInteractionData{
				Name: "play",
			},
		},
	}

	err := router.Process(nil, interaction)
	if err != nil {
		t.Errorf("unexpected error: %v", err)
	}

	if !called {
		t.Errorf("expected play command to be executed")
	}

	// Inactive command check
	router.Register(command.Command{
		ApplicationCommand: &dg.ApplicationCommand{
			Name:        "hidden",
			Description: "Hidden command",
		},
		Active: false,
		Run: func(s *dg.Session, i *dg.InteractionCreate) error {
			return nil
		},
	})

	inactiveInteraction := &dg.InteractionCreate{
		Interaction: &dg.Interaction{
			Type: dg.InteractionApplicationCommand,
			Data: dg.ApplicationCommandInteractionData{
				Name: "hidden",
			},
		},
	}

	err = router.Process(nil, inactiveInteraction)
	if !errors.Is(err, command.ErrUnknownOrUnavailableCommand) {
		t.Errorf("expected ErrUnknownOrUnavailableCommand, got %v", err)
	}
}
