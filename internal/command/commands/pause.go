package commands

import (
	"github.com/larahfelipe/saturn/internal/bot"
	"github.com/larahfelipe/saturn/internal/command"
	"github.com/larahfelipe/saturn/internal/player"
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

func (psc *PauseSongCommand) Execute(m *command.Message) error {
	bot := bot.GetInstance()
	queue := player.GetInstance()

	if queue.Idle {
		bot.DS.SendReplyMessage(m.Message, "There is no song playing right now")

		return nil
	}

	queue.Mutex.Lock()
	defer queue.Mutex.Unlock()

	queue.PlaybackState <- player.PAUSE

	bot.DS.Session.MessageReactionAdd(m.ChannelID, m.ID, "⏸️")

	return nil
}
