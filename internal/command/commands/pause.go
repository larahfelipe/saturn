package commands

import (
	"github.com/larahfelipe/saturn/internal/bot"
	"github.com/larahfelipe/saturn/internal/command"
	"github.com/larahfelipe/saturn/internal/player"
)

type PauseSongCommand struct {
	*command.BaseCommand
	Bot   *bot.Bot
	Queue *player.Queue
}

func NewPauseSongCommand(bot *bot.Bot, queue *player.Queue) *PauseSongCommand {
	return &PauseSongCommand{
		BaseCommand: command.NewBaseCommand("pause", "Pause the current song", true),
		Bot:         bot,
		Queue:       queue,
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
	if psc.Queue.Idle {
		psc.Bot.DS.SendReplyMessage(m.Message, "There is no song playing right now")
		return nil
	}

	psc.Queue.PlaybackState <- player.PAUSE
	psc.Bot.DS.Session.MessageReactionAdd(m.ChannelID, m.ID, "⏸️")

	return nil
}
