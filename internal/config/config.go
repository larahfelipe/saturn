package config

import (
	"fmt"
	"log"
	"os"

	env "github.com/joho/godotenv"
)

type Config struct {
	BotToken       string
	BotPrefix      string
	BotStatus      string
	AppEnvironment string
	AppLogsDirName string
}

func New() (*Config, error) {
	if err := env.Load(); err != nil {
		log.Printf("environment variables load warning: %s", err)
	}

	cfg := &Config{
		BotToken:       os.Getenv("BOT_TOKEN"),
		BotPrefix:      os.Getenv("BOT_COMMAND_PREFIX"),
		BotStatus:      os.Getenv("BOT_ACTIVITY_STATUS"),
		AppEnvironment: os.Getenv("APP_ENVIRONMENT"),
		AppLogsDirName: ".logs",
	}

	if cfg.BotToken == "" {
		return nil, fmt.Errorf("BOT_TOKEN is required")
	}

	return cfg, nil
}
