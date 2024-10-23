package youtube

import (
	"sync"

	yt "github.com/kkdai/youtube/v2"
)

var (
	once     sync.Once
	instance *yt.Client
)

// newYoutubeClient creates a new `yt.Client` record.
func newYoutubeClient() *yt.Client {
	return &yt.Client{}
}

// GetInstance returns a singleton instance of `youtube.Client`.
func GetInstance() *yt.Client {
	once.Do(func() {
		instance = newYoutubeClient()
	})

	return instance
}
