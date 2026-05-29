package player_test

import (
	"sync"
	"testing"

	"github.com/larahfelipe/saturn/internal/config"
	"github.com/larahfelipe/saturn/internal/player"
	"go.uber.org/zap"
)

func TestQueueConcurrentOperations(t *testing.T) {
	logger := zap.NewNop()
	cfg := &config.Config{}
	q := player.New(cfg, logger)

	var wg sync.WaitGroup
	workers := 20
	iterations := 100

	// Test concurrent Add operations
	for i := 0; i < workers; i++ {
		wg.Add(1)
		go func(workerID int) {
			defer wg.Done()
			for j := 0; j < iterations; j++ {
				q.Add(&player.Song{
					Title: "Test Song",
				})
			}
		}(i)
	}

	wg.Wait()

	expectedCount := workers * iterations
	if q.GetSongCount() != expectedCount {
		t.Errorf("expected song count %d, got %d", expectedCount, q.GetSongCount())
	}

	// Test concurrent Shift operations
	for i := 0; i < workers; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for j := 0; j < iterations; j++ {
				q.Shift()
			}
		}()
	}

	wg.Wait()

	if q.GetSongCount() != 0 {
		t.Errorf("expected empty queue, got %d songs left", q.GetSongCount())
	}
}
