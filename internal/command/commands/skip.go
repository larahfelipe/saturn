package commands

import (
	"github.com/larahfelipe/saturn/internal/bot"
	"github.com/larahfelipe/saturn/internal/command"
	"github.com/larahfelipe/saturn/internal/player"
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

func (ssc *SkipSongCommand) Execute(m *command.Message) error {
	bot := bot.GetInstance()
	queue := player.GetInstance()

	if queue.Idle {
		bot.DS.SendReplyMessage(m.Message, "There is no song playing right now")

		return nil
	}

	queue.Mutex.Lock()
	defer queue.Mutex.Unlock()

	queue.PlaybackState <- player.SKIP

	bot.DS.AddMessageReaction(m.Message, "⏭️")

	return nil
}
