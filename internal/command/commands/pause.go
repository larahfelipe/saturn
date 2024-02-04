package commands

import (
	"github.com/larahfelipe/saturn/internal/bot"
	"github.com/larahfelipe/saturn/internal/command"
	"github.com/larahfelipe/saturn/internal/music"
)

type PauseSongCommand struct {
	*command.BaseCommand
}

func NewPauseSongCommand() *PauseSongCommand {
	return &PauseSongCommand{
		BaseCommand: command.NewBaseCommand("pause", "Pause the current song", true),
	}
}

func (psc *PauseSongCommand) Active() bool {
	return psc.BaseCommand.Active
}

func (psc *PauseSongCommand) Name() string {
	return psc.BaseCommand.Name
}

func (psc *PauseSongCommand) Help() string {
	return psc.BaseCommand.Help
}

func (psc *PauseSongCommand) Execute(bot *bot.Bot, m *command.Message) {
	queue := bot.Module.Queue
	if !queue.IsPlaying {
		bot.Session.ChannelMessageSendReply(m.ChannelID, "There's nothing to sing along right now", m.Reference())
	}

	queue.Mutex.Lock()
	defer queue.Mutex.Unlock()

	queue.PlaybackState <- music.PAUSE

	bot.Session.MessageReactionAdd(m.ChannelID, m.ID, "⏸️")
}
