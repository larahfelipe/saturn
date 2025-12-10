package commands

import (
	"github.com/larahfelipe/saturn/internal/bot"
	"github.com/larahfelipe/saturn/internal/command"
	"github.com/larahfelipe/saturn/internal/player"
)

type SkipSongCommand struct {
	*command.BaseCommand
	Bot   *bot.Bot
	Queue *player.Queue
}

func NewSkipSongCommand(bot *bot.Bot, queue *player.Queue) *SkipSongCommand {
	return &SkipSongCommand{
		BaseCommand: command.NewBaseCommand("skip", "Skip the current song", true),
		Bot:         bot,
		Queue:       queue,
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
	if ssc.Queue.Idle {
		ssc.Bot.DS.SendReplyMessage(m.Message, "There is no song playing right now")
		return nil
	}

	ssc.Queue.PlaybackState <- player.SKIP
	ssc.Bot.DS.AddMessageReaction(m.Message, "⏭️")

	return nil
}
