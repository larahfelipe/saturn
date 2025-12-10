package commands

import (
	"github.com/larahfelipe/saturn/internal/bot"
	"github.com/larahfelipe/saturn/internal/command"
	"github.com/larahfelipe/saturn/internal/player"
)

type StopSongCommand struct {
	*command.BaseCommand
	Bot   *bot.Bot
	Queue *player.Queue
}

func NewStopSongCommand(bot *bot.Bot, queue *player.Queue) *StopSongCommand {
	return &StopSongCommand{
		BaseCommand: command.NewBaseCommand("stop", "Stop the current song", true),
		Bot:         bot,
		Queue:       queue,
	}
}

func (ssc *StopSongCommand) Active() bool {
	return ssc.BaseCommand.Active
}

func (ssc *StopSongCommand) Name() string {
	return ssc.BaseCommand.Name
}

func (ssc *StopSongCommand) Help() string {
	return ssc.BaseCommand.Help
}

func (ssc *StopSongCommand) Execute(m *command.Message) error {
	if ssc.Queue.Idle {
		ssc.Bot.DS.SendReplyMessage(m.Message, "There is no song playing right now")
		return nil
	}

	ssc.Queue.PlaybackState <- player.IDLE
	ssc.Bot.DS.AddMessageReaction(m.Message, "🛑")

	return nil
}
