package main

import (
	"log"

	"go.uber.org/zap"

	"github.com/larahfelipe/saturn/internal/command"
	"github.com/larahfelipe/saturn/internal/command/commands"
	"github.com/larahfelipe/saturn/internal/config"
	"github.com/larahfelipe/saturn/internal/discord"
	"github.com/larahfelipe/saturn/internal/logger"
	"github.com/larahfelipe/saturn/internal/player"
	"github.com/larahfelipe/saturn/internal/youtube"
)

func main() {
	cfg, err := config.New()
	if err != nil {
		log.Fatalf("config error: %v", err)
	}

	logInst, err := logger.New(cfg)
	if err != nil {
		log.Fatalf("logger initialization error: %v", err)
	}
	defer logInst.Sync()

	bot, err := discord.New(cfg, logInst)
	if err != nil {
		logInst.Fatal("bot initialization error", zap.Error(err))
	}

	registry := player.NewRegistry(cfg, logInst)
	defer registry.ResetAll()

	yt := youtube.New()

	router, err := command.NewRouter(cfg.BotPrefix)
	if err != nil {
		logInst.Fatal("command router init error", zap.Error(err))
	}

	// Register functional command handlers
	router.Register(command.Command{
		Name:        "play",
		Description: "Play a YouTube video audio",
		Active:      true,
		Run:         commands.Play(bot, registry, yt),
	})
	router.Register(command.Command{
		Name:        "pause",
		Description: "Pause the currently playing song",
		Active:      true,
		Run:         commands.Pause(bot, registry),
	})
	router.Register(command.Command{
		Name:        "unpause",
		Description: "Resume song playback",
		Active:      true,
		Run:         commands.Unpause(bot, registry),
	})
	router.Register(command.Command{
		Name:        "skip",
		Description: "Skip the currently playing song",
		Active:      true,
		Run:         commands.Skip(bot, registry),
	})
	router.Register(command.Command{
		Name:        "stop",
		Description: "Stop playback and clear the queue",
		Active:      true,
		Run:         commands.Stop(bot, registry),
	})
	router.Register(command.Command{
		Name:        "ping",
		Description: "Verify bot responsiveness",
		Active:      true,
		Run:         commands.Ping(bot),
	})
	router.Register(command.Command{
		Name:        "health",
		Description: "Check bot heartbeat latency",
		Active:      true,
		Run:         commands.Health(bot),
	})
	router.Register(command.Command{
		Name:        "help",
		Description: "Show available commands list",
		Active:      true,
		Run:         commands.Help(bot, router),
	})

	bot.Prepare(router)
	bot.Run()
}
