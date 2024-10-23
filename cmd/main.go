package main

import (
	"log"

	"go.uber.org/zap"

	"github.com/larahfelipe/saturn/internal/bot"
	"github.com/larahfelipe/saturn/internal/command"
	"github.com/larahfelipe/saturn/internal/command/commands"
	"github.com/larahfelipe/saturn/internal/config"
	"github.com/larahfelipe/saturn/internal/player"
	"github.com/larahfelipe/saturn/internal/util"
)

func main() {
	config.Load()

	if _, err := util.NewLogger(); err != nil {
		log.Fatalf("logger initialization error: %v", err)
	}
	defer zap.L().Sync()

	bot := bot.GetInstance()
	command := command.GetInstance()

	bot.Prepare(command,
		commands.NewHealthCommand(),
		commands.NewHelpCommand(),
		commands.NewPauseSongCommand(),
		commands.NewPingCommand(),
		commands.NewPlaySongCommand(),
		commands.NewSkipSongCommand(),
		commands.NewStopSongCommand(),
		commands.NewUnpauseSongCommand(),
	)

	queue := player.GetInstance()
	go queue.Process()
	defer queue.Reset(true)

	bot.Run()
}
