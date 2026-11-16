package logger

import (
	"fmt"
	"os"

	"github.com/larahfelipe/saturn/internal/config"
	"go.uber.org/zap"
)

// New creates a new zap.Logger instance.
func New(cfg *config.Config) (*zap.Logger, error) {
	var log *zap.Logger
	var err error

	if cfg.AppEnvironment == "development" {
		log, err = zap.NewDevelopment()
	} else {
		// Secure logs directory creation
		if err := os.MkdirAll(cfg.AppLogsDirName, 0750); err != nil {
			return nil, fmt.Errorf("logs directory creation error: %w", err)
		}

		zapProdCfg := zap.NewProductionConfig()
		zapProdCfg.Level = zap.NewAtomicLevel()
		zapProdCfg.OutputPaths = []string{"stdout", fmt.Sprintf("%s/app.log", cfg.AppLogsDirName)}

		log, err = zapProdCfg.Build()
	}

	if err != nil {
		return nil, err
	}

	zap.ReplaceGlobals(log)

	return log, nil
}
