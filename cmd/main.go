package main

import (
	"fmt"
	"os"

	env "github.com/joho/godotenv"
	"go.uber.org/zap"

	"github.com/larahfelipe/saturn/internal/bot"
	"github.com/larahfelipe/saturn/internal/command"
	"github.com/larahfelipe/saturn/internal/util"
)

func main() {
	if err := env.Load(); err != nil {
		panic(fmt.Sprintf("environment variables load error: %s", err))
	}

	botCmdPrefix := os.Getenv("BOT_PREFIX")
	botToken := os.Getenv("BOT_TOKEN")

	util.NewLogger()

	command, err := command.New(botCmdPrefix)
	if err != nil {
		zap.L().Fatal(fmt.Sprintf("command creation error: %s", err))
	}

	bot, err := bot.New(botToken, command)
	if err != nil {
		zap.L().Fatal(fmt.Sprintf("bot creation error: %s", err))
	}

	if err := bot.Connect(); err != nil {
		zap.L().Fatal(fmt.Sprintf("discord websocket open connection error: %s", err))
	}

	bot.Session.UpdateWatchStatus(0, "the stars")

	// go bot.Feature.MusicQueue.Process()

	// defer bot.Feature.MusicQueue.Cleanup(true)

	fmt.Println("")
	zap.L().Info(fmt.Sprintf("bot is now connected as %s and it's ready to listen for interactions", bot.Session.State.User.Username))

	util.Shutdown(bot)
}
