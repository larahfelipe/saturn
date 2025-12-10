package util

import (
	"fmt"

	"github.com/larahfelipe/saturn/internal/config"
	"go.uber.org/zap"
)

// NewLogger creates a new logger instance.
func NewLogger(cfg *config.Config) (*zap.Logger, error) {
	var logger *zap.Logger
	var err error

	if cfg.AppEnvironment == "development" {
		logger, err = zap.NewDevelopment()
	} else {
		if err := MkDir(cfg.AppLogsDirName); err != nil {
			return nil, fmt.Errorf("logs directory creation error: %w", err)
		}

		zapProdCfg := zap.NewProductionConfig()
		zapProdCfg.Level = zap.NewAtomicLevel()
		zapProdCfg.OutputPaths = []string{"stdout", fmt.Sprintf("%s/app.log", cfg.AppLogsDirName)}

		logger, err = zapProdCfg.Build()
	}

	if err != nil {
		return nil, err
	}

	zap.ReplaceGlobals(logger)

	return logger, nil
}
