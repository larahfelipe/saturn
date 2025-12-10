package youtube

import (
	yt "github.com/kkdai/youtube/v2"
)

// New creates a new `yt.Client` record.
func New() *yt.Client {
	return &yt.Client{}
}
