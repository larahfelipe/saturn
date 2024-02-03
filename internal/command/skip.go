package command

import (
	"github.com/larahfelipe/saturn/internal/bot"
	"github.com/larahfelipe/saturn/internal/music"
)

func skipSongCommand(bot *bot.Bot, m *bot.Message) {
	mq := bot.Feature.MusicQueue
	mq.Mutex.Lock()
	defer mq.Mutex.Unlock()

	mq.PlaybackState <- music.SKIP

	bot.Session.MessageReactionAdd(m.ChannelID, m.ID, "⏭️")
}
