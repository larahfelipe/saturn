package metrics

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

var (
	// CommandsProcessed tracks command executions labelled by command name.
	CommandsProcessed = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "saturn_commands_processed_total",
			Help: "The total number of commands processed by the bot",
		},
		[]string{"command"},
	)

	// ActivePlayers tracks the number of concurrent player queue instances.
	ActivePlayers = promauto.NewGauge(
		prometheus.GaugeOpts{
			Name: "saturn_active_players",
			Help: "The number of active guild players running",
		},
	)
)
