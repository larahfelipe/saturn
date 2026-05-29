package command_test

import (
	"errors"
	"testing"

	dg "github.com/bwmarrin/discordgo"
	"github.com/larahfelipe/saturn/internal/command"
)

func TestRouterProcess(t *testing.T) {
	router, err := command.NewRouter("!")
	if err != nil {
		t.Fatalf("unexpected error creating router: %v", err)
	}

	var called bool
	var capturedArgs []string

	router.Register(command.Command{
		Name:   "play",
		Active: true,
		Run: func(s *dg.Session, m *dg.MessageCreate, args []string) error {
			called = true
			capturedArgs = args
			return nil
		},
	})

	// Match registered prefix command
	msg := &dg.MessageCreate{
		Message: &dg.Message{
			Content: "play https://youtube.com/watch?v=123",
		},
	}

	err = router.Process(nil, msg)
	if err != nil {
		t.Errorf("unexpected router error: %v", err)
	}

	if !called {
		t.Errorf("expected command handler to be executed")
	}

	if len(capturedArgs) != 1 || capturedArgs[0] != "https://youtube.com/watch?v=123" {
		t.Errorf("incorrect args parsed: %v", capturedArgs)
	}

	// Try triggering inactive command
	router.Register(command.Command{
		Name:   "hidden",
		Active: false,
		Run: func(s *dg.Session, m *dg.MessageCreate, args []string) error {
			return nil
		},
	})

	inactiveMsg := &dg.MessageCreate{
		Message: &dg.Message{
			Content: "hidden",
		},
	}

	err = router.Process(nil, inactiveMsg)
	if !errors.Is(err, command.ErrUnknownOrUnavailableCommand) {
		t.Errorf("expected ErrUnknownOrUnavailableCommand, got %v", err)
	}
}
