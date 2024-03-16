package commands

import (
	"github.com/larahfelipe/saturn/internal/bot"
	"github.com/larahfelipe/saturn/internal/command"
	"github.com/larahfelipe/saturn/internal/music"
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

func (ssc *StopSongCommand) Execute(bot *bot.Bot, m *command.Message) error {
	queue := bot.Module.Queue
	queue.Mutex.Lock()
	defer queue.Mutex.Unlock()

	queue.PlaybackState <- music.IDLE

	bot.Session.MessageReactionAdd(m.ChannelID, m.ID, "🛑")

	return nil
}
