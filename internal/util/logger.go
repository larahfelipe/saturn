package util

import (
	"fmt"
	"log"

	"github.com/larahfelipe/saturn/internal/config"
	"go.uber.org/zap"
)

// NewLogger creates a new logger instance.
func NewLogger() (*zap.Logger, error) {
	var logger *zap.Logger
	var err error

	if config.GetAppEnvironment() == "development" {
		logger, err = zap.NewDevelopment()
	} else {
		if err := MkDir(config.GetAppLogsDirName()); err != nil {
			log.Fatalf("logs directory creation error: %s", err)
		}

		zapProdCfg := zap.NewProductionConfig()
		zapProdCfg.Level = zap.NewAtomicLevel()
		zapProdCfg.OutputPaths = []string{"stdout", fmt.Sprintf("%s/app.log", config.GetAppLogsDirName())}

		logger, err = zapProdCfg.Build()
	}

	if err != nil {
		return nil, err
	}

	zap.ReplaceGlobals(logger)

	return logger, nil
}
