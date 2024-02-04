package commands

import (
	"github.com/larahfelipe/saturn/internal/bot"
	"github.com/larahfelipe/saturn/internal/command"
	"github.com/larahfelipe/saturn/internal/music"
)

type SkipSongCommand struct {
	*command.BaseCommand
}

func NewSkipSongCommand() *SkipSongCommand {
	return &SkipSongCommand{
		BaseCommand: command.NewBaseCommand("skip", "Skip the current song", true),
	}
}

func (ssc *SkipSongCommand) Active() bool {
	return ssc.BaseCommand.Active
}

func (ssc *SkipSongCommand) Name() string {
	return ssc.BaseCommand.Name
}

func (ssc *SkipSongCommand) Help() string {
	return ssc.BaseCommand.Help
}

func (ssc *SkipSongCommand) Execute(bot *bot.Bot, m *command.Message) {
	queue := bot.Module.Queue
	queue.Mutex.Lock()
	defer queue.Mutex.Unlock()

	queue.PlaybackState <- music.SKIP

	bot.Session.MessageReactionAdd(m.ChannelID, m.ID, "⏭️")
}
