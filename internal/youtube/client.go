package youtube

import (
	"errors"

	yt "github.com/kkdai/youtube/v2"
)

var ErrMissingYoutubeVideoUrl = errors.New("missing youtube video url")

// New creates a new `yt.Client` record.
func New() *yt.Client {
	return &yt.Client{}
}
