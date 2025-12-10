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
	"github.com/larahfelipe/saturn/internal/youtube"
)

func main() {
	cfg, err := config.New()
	if err != nil {
		log.Fatalf("config error: %v", err)
	}

	logger, err := util.NewLogger(cfg)
	if err != nil {
		log.Fatalf("logger initialization error: %v", err)
	}
	defer logger.Sync()

	bot, err := bot.New(cfg, logger)
	if err != nil {
		logger.Fatal("bot initialization error", zap.Error(err))
	}

	queue := player.New(cfg, logger)
	go queue.Process()
	defer queue.Reset()

	yt := youtube.New()

	cmdProcessor, err := command.New(cfg.BotPrefix)
	if err != nil {
		logger.Fatal("command processor init error", zap.Error(err))
	}

	bot.Prepare(cmdProcessor,
		commands.NewHealthCommand(bot),
		commands.NewHelpCommand(bot),
		commands.NewPauseSongCommand(bot, queue),
		commands.NewPingCommand(bot),
		commands.NewPlaySongCommand(bot, queue, yt),
		commands.NewSkipSongCommand(bot, queue),
		commands.NewStopSongCommand(bot, queue),
		commands.NewUnpauseSongCommand(bot, queue),
	)

	bot.Run()
}
