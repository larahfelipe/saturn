package command

import "github.com/larahfelipe/saturn/internal/bot"

func pingCommand(bot *bot.Bot, m *bot.Message) {
	bot.Session.ChannelMessageSendReply(m.ChannelID, "Pong!", m.Reference())
}
