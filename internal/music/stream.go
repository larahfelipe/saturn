package music

import (
	"fmt"
	"io"
	"os/exec"

	"github.com/bwmarrin/discordgo"
	"github.com/jonas747/dca"

	"github.com/larahfelipe/saturn/internal/utils"
)

type StreamSession struct {
	Error error
	State PlaybackState
}

type Stream struct {
	Song            *Song
	VoiceConnection *discordgo.VoiceConnection
}

type StreamData struct {
	Url          string
	MimeType     string
	AudioQuality string
	Bitrate      int
	Readable     io.ReadCloser
}

func (stream *Stream) Stream(streamSessionChan chan StreamSession) {
	if _, err := exec.LookPath("ffmpeg"); err != nil {
		streamSessionChan <- StreamSession{Error: fmt.Errorf("ffmpeg path lookup error: %s", err)}
		return
	}

	// NOTE: temporarily downloading the song to prevent unexpected streaming behavior.
	// It appears that dca is either unable to encode the stream URL properly or the stream URL provided by youtube-dl is not fully compatible with dca.
	// This is causing playback to stop before the song actually ends.

	sfp, err := stream.Song.Download()
	if err != nil {
		streamSessionChan <- StreamSession{Error: fmt.Errorf("stream download error: %s", err)}
		return
	}

	defer func() {
		if err := utils.DeleteFile(sfp); err != nil {
			streamSessionChan <- StreamSession{Error: fmt.Errorf("stream file removal error: %s", err)}
		}
	}()

	options := dca.StdEncodeOptions
	options.RawOutput = true
	options.Bitrate = 96

	es, err := dca.EncodeFile(sfp, options)
	if err != nil {
		streamSessionChan <- StreamSession{Error: fmt.Errorf("stream encode error: %s", err)}
		return
	}

	defer es.Cleanup()

	doneChan := make(chan error)
	streamSession := dca.NewStream(es, stream.VoiceConnection, doneChan)

	for {
		select {
		case ssr := <-streamSessionChan:
			switch ssr.State {
			case UNPAUSE:
				streamSession.SetPaused(false)

			case PAUSE, SKIP:
				streamSession.SetPaused(true)

			case SIGNAL:
				// exits the stream session
				return
			}

		case err := <-doneChan:
			// dca signals the end of a stream session by sending an io.EOF error, therefore we need to exclude it as an error
			if err != nil && err != io.EOF {
				streamSessionChan <- StreamSession{Error: fmt.Errorf("stream session error: %v", err)}
			} else {
				streamSessionChan <- StreamSession{State: SIGNAL}
			}
			return
		}
	}
}
