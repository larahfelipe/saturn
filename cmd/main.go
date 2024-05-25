package main

import (
	"fmt"
	"os"

	env "github.com/joho/godotenv"
	"go.uber.org/zap"

	"github.com/larahfelipe/saturn/internal/bot"
	"github.com/larahfelipe/saturn/internal/command"
	"github.com/larahfelipe/saturn/internal/command/commands"
	"github.com/larahfelipe/saturn/internal/music"
	"github.com/larahfelipe/saturn/internal/util"
	"github.com/larahfelipe/saturn/pkg/youtube"
)

func main() {
	if err := env.Load(); err != nil {
		panic(fmt.Sprintf("environment variables load error: %s", err))
	}

	token, prefix := os.Getenv("BOT_TOKEN"), os.Getenv("BOT_CMD_PREFIX")

	util.NewLogger()

	module := &bot.Module{
		Core: &bot.Core{
			Queue: music.New(),
		},
		Extension: &bot.Extension{
			Youtube: youtube.New(),
		},
	}

	bot, err := bot.New(token, module)
	if err != nil {
		zap.L().Fatal(fmt.Sprintf("bot creation error: %s", err))
	}

	c, err := command.New(prefix, bot)
	if err != nil {
		zap.L().Fatal(fmt.Sprintf("command creation error: %s", err))
	}

	c.Load(
		commands.NewHealthCommand(),
		commands.NewHelpCommand(),
		commands.NewPauseSongCommand(),
		commands.NewPingCommand(),
		commands.NewPlaySongCommand(),
		commands.NewSkipSongCommand(),
		commands.NewStopSongCommand(),
		commands.NewUnpauseSongCommand(),
	)

	bot.CommandMessageCreateHandler(c.Process, c.Prefix)

	if err := bot.Connect(); err != nil {
		zap.L().Fatal(fmt.Sprintf("discord ws connection opening error: %s", err))
	}

	bot.Session.UpdateWatchStatus(0, "the stars")

	go bot.Module.Queue.Process()
	defer bot.Module.Queue.Cleanup(true)

	fmt.Println("")
	zap.L().Info(fmt.Sprintf("bot is now connected as %s and it's ready to listen for interactions", bot.Session.State.User.Username))

	util.Shutdown()

	if err := bot.Disconnect(); err != nil {
		zap.L().Fatal(fmt.Sprintf("discord ws connection closing error: %s", err))
	}
}
