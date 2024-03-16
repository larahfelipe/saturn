package commands

import (
	"github.com/larahfelipe/saturn/internal/bot"
	"github.com/larahfelipe/saturn/internal/command"
	"github.com/larahfelipe/saturn/internal/music"
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

func (usc *UnpauseSongCommand) Execute(bot *bot.Bot, m *command.Message) error {
	queue := bot.Module.Queue
	if !queue.IsPlaying {
		bot.Session.ChannelMessageSendReply(m.ChannelID, "There's nothing to sing along right now", m.Reference())
	}

	queue.Mutex.Lock()
	defer queue.Mutex.Unlock()

	queue.PlaybackState <- music.UNPAUSE

	bot.Session.MessageReactionAdd(m.ChannelID, m.ID, "▶️")

	return nil
}
