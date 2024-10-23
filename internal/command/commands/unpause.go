package commands

import (
	"github.com/larahfelipe/saturn/internal/bot"
	"github.com/larahfelipe/saturn/internal/command"
	"github.com/larahfelipe/saturn/internal/player"
)

type UnpauseSongCommand struct {
	*command.BaseCommand
}

func NewUnpauseSongCommand() *UnpauseSongCommand {
	return &UnpauseSongCommand{
		BaseCommand: command.NewBaseCommand("unpause", "Unpause the current song", true),
	}
}

func (usc *UnpauseSongCommand) Active() bool {
	return usc.BaseCommand.Active
}

func (usc *UnpauseSongCommand) Name() string {
	return usc.BaseCommand.Name
}

func (usc *UnpauseSongCommand) Help() string {
	return usc.BaseCommand.Help
}

func (usc *UnpauseSongCommand) Execute(m *command.Message) error {
	bot := bot.GetInstance()
	queue := player.GetInstance()

	if queue.Idle {
		bot.DS.SendReplyMessage(m.Message, "There is no song playing right now")

		return nil
	}

	queue.Mutex.Lock()
	defer queue.Mutex.Unlock()

	queue.PlaybackState <- player.UNPAUSE

	bot.DS.AddMessageReaction(m.Message, "▶️")

	return nil
}
