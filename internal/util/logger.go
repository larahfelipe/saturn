package util

import (
	"os"

	"go.uber.org/zap"
)

func NewLogger() {
	zl := zap.Must(zap.NewProduction())

	if env := os.Getenv("APP_ENV"); env == "development" {
		zl = zap.Must(zap.NewDevelopment())
	}

	zap.ReplaceGlobals(zl)
}
