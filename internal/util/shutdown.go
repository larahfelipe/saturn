package util

import (
	"os"
	"os/signal"
	"syscall"

	"github.com/larahfelipe/saturn/internal/bot"
)

func Shutdown(bot *bot.Bot) {
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM, os.Interrupt)
	<-sigChan

	bot.DS.Disconnect()
}
