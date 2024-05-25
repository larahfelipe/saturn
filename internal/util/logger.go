package util

import (
	"os"

	"go.uber.org/zap"
)

// NewLogger creates a new logger instance.
func NewLogger() {
	zl := zap.Must(zap.NewProduction())

	if env := os.Getenv("APP_ENV"); env == "development" {
		zl = zap.Must(zap.NewDevelopment())
	}

	zap.ReplaceGlobals(zl)
}
