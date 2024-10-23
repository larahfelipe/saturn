package commands

import (
	"github.com/larahfelipe/saturn/internal/bot"
	"github.com/larahfelipe/saturn/internal/command"
	"github.com/larahfelipe/saturn/internal/player"
)

type StopSongCommand struct {
	*command.BaseCommand
}

func NewStopSongCommand() *StopSongCommand {
	return &StopSongCommand{
		BaseCommand: command.NewBaseCommand("stop", "Stop the current song", true),
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
	bot := bot.GetInstance()
	queue := player.GetInstance()

	if queue.Idle {
		bot.DS.SendReplyMessage(m.Message, "There is no song playing right now")

		return nil
	}

	queue.Mutex.Lock()
	defer queue.Mutex.Unlock()

	queue.PlaybackState <- player.IDLE

	bot.DS.AddMessageReaction(m.Message, "🛑")

	return nil
}
