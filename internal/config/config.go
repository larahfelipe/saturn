package config

import (
	"log"
	"os"

	env "github.com/joho/godotenv"
)

type Config struct {
	BotToken            string
	BotPrefix           string
	BotStatus           string
	AppEnvironment      string
	AppDownloadsDirName string
	AppLogsDirName      string
}

var cfg *Config

func Load() {
	if err := env.Load(); err != nil {
		log.Fatalf("environment variables load error: %s", err)
	}

	cfg = &Config{
		BotToken:            os.Getenv("BOT_TOKEN"),
		BotPrefix:           os.Getenv("BOT_COMMAND_PREFIX"),
		BotStatus:           os.Getenv("BOT_ACTIVITY_STATUS"),
		AppEnvironment:      os.Getenv("APP_ENVIRONMENT"),
		AppDownloadsDirName: ".dl",
		AppLogsDirName:      ".logs",
	}
}

func GetBotToken() string {
	return cfg.BotToken
}

func GetBotPrefix() string {
	return cfg.BotPrefix
}

func GetBotStatus() string {
	return cfg.BotStatus
}

func GetAppEnvironment() string {
	return cfg.AppEnvironment
}

func GetAppDownloadsDirName() string {
	return cfg.AppDownloadsDirName
}

func GetAppLogsDirName() string {
	return cfg.AppLogsDirName
}
