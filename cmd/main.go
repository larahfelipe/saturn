package main

import (
	"log"
	"net/http"

	"github.com/prometheus/client_golang/prometheus/promhttp"
	"go.uber.org/zap"

	dg "github.com/bwmarrin/discordgo"
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

	router := command.NewRouter()

	// Register Slash Command configs
	router.Register(command.Command{
		ApplicationCommand: &dg.ApplicationCommand{
			Name:        "play",
			Description: "Play a YouTube video audio",
			Options: []*dg.ApplicationCommandOption{
				{
					Type:        dg.ApplicationCommandOptionString,
					Name:        "url",
					Description: "The YouTube video URL",
					Required:    true,
				},
			},
		},
		Active: true,
		Run:    commands.Play(bot, registry, yt),
	})
	router.Register(command.Command{
		ApplicationCommand: &dg.ApplicationCommand{
			Name:        "pause",
			Description: "Pause the currently playing song",
		},
		Active: true,
		Run:    commands.Pause(bot, registry),
	})
	router.Register(command.Command{
		ApplicationCommand: &dg.ApplicationCommand{
			Name:        "unpause",
			Description: "Resume song playback",
		},
		Active: true,
		Run:    commands.Unpause(bot, registry),
	})
	router.Register(command.Command{
		ApplicationCommand: &dg.ApplicationCommand{
			Name:        "skip",
			Description: "Skip the currently playing song",
		},
		Active: true,
		Run:    commands.Skip(bot, registry),
	})
	router.Register(command.Command{
		ApplicationCommand: &dg.ApplicationCommand{
			Name:        "stop",
			Description: "Stop playback and clear the queue",
		},
		Active: true,
		Run:    commands.Stop(bot, registry),
	})
	router.Register(command.Command{
		ApplicationCommand: &dg.ApplicationCommand{
			Name:        "ping",
			Description: "Verify bot responsiveness",
		},
		Active: true,
		Run:    commands.Ping(bot),
	})
	router.Register(command.Command{
		ApplicationCommand: &dg.ApplicationCommand{
			Name:        "health",
			Description: "Check bot heartbeat latency",
		},
		Active: true,
		Run:    commands.Health(bot),
	})
	router.Register(command.Command{
		ApplicationCommand: &dg.ApplicationCommand{
			Name:        "help",
			Description: "Show available commands list",
		},
		Active: true,
		Run:    commands.Help(bot, router),
	})

	bot.Prepare(router, registry)

	// Start Prometheus HTTP Metrics exporter on port 8080
	go func() {
		http.Handle("/metrics", promhttp.Handler())
		logInst.Info("metrics endpoint listening on port 8080")
		if err := http.ListenAndServe(":8080", nil); err != nil {
			logInst.Error("metrics server listener error", zap.Error(err))
		}
	}()

	bot.Run(router)
}
