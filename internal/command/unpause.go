package command

import (
	"github.com/larahfelipe/saturn/internal/bot"
	"github.com/larahfelipe/saturn/internal/music"
)

func unpauseSongCommand(bot *bot.Bot, m *bot.Message) {
	mq := bot.Feature.MusicQueue
	if !mq.IsPlaying {
		bot.Session.ChannelMessageSendReply(m.ChannelID, "There's nothing to sing along right now", m.Reference())
	}

	mq.Mutex.Lock()
	defer mq.Mutex.Unlock()

	mq.PlaybackState <- music.UNPAUSE

	bot.Session.MessageReactionAdd(m.ChannelID, m.ID, "▶️")
}
