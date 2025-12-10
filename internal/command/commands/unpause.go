package commands

import (
	"github.com/larahfelipe/saturn/internal/bot"
	"github.com/larahfelipe/saturn/internal/command"
	"github.com/larahfelipe/saturn/internal/player"
)

type UnpauseSongCommand struct {
	*command.BaseCommand
	Bot   *bot.Bot
	Queue *player.Queue
}

func NewUnpauseSongCommand(bot *bot.Bot, queue *player.Queue) *UnpauseSongCommand {
	return &UnpauseSongCommand{
		BaseCommand: command.NewBaseCommand("unpause", "Unpause the current song", true),
		Bot:         bot,
		Queue:       queue,
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
	if usc.Queue.Idle {
		usc.Bot.DS.SendReplyMessage(m.Message, "There is no song playing right now")
		return nil
	}

	usc.Queue.PlaybackState <- player.UNPAUSE
	usc.Bot.DS.AddMessageReaction(m.Message, "▶️")

	return nil
}
