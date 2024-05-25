package music

import (
	"fmt"
	"io"
	"math"
	"os/exec"

	"github.com/bwmarrin/discordgo"
	"github.com/jonas747/dca"

	"github.com/larahfelipe/saturn/internal/util"
)

type StreamSession struct {
	Error error
	State PlaybackState
}

type VoiceChannel struct {
	Bitrate    int
	Connection *discordgo.VoiceConnection
}

type Stream struct {
	Song         *Song
	VoiceChannel *VoiceChannel
}

type StreamData struct {
	Url          string
	MimeType     string
	AudioQuality string
	Bitrate      int
	Readable     io.ReadCloser
}

// Stream streams a song on a voice channel.
func (stream *Stream) Stream(streamSessionChan chan StreamSession) {
	if _, err := exec.LookPath("ffmpeg"); err != nil {
		streamSessionChan <- StreamSession{Error: fmt.Errorf("ffmpeg path lookup error: %s", err)}
		return
	}

	sfp, err := stream.Song.Download()
	if err != nil {
		streamSessionChan <- StreamSession{Error: fmt.Errorf("stream download error: %s", err)}
		return
	}
	defer func() {
		if err := util.DeleteFile(sfp); err != nil {
			streamSessionChan <- StreamSession{Error: fmt.Errorf("stream file removal error: %s", err)}
		}
	}()

	options := dca.StdEncodeOptions
	options.RawOutput = true
	options.Bitrate = stream.VoiceChannel.Bitrate / int(math.Pow10(3))
	if stream.VoiceChannel.Bitrate > 128 {
		// dca only supports bitrate values between 8 and 128
		options.Bitrate = 128
	}

	es, err := dca.EncodeFile(sfp, options)
	if err != nil {
		streamSessionChan <- StreamSession{Error: fmt.Errorf("stream encode error: %s", err)}
		return
	}
	defer es.Cleanup()

	doneChan := make(chan error)
	streamSession := dca.NewStream(es, stream.VoiceChannel.Connection, doneChan)

	for {
		select {
		case ssr := <-streamSessionChan:
			switch ssr.State {
			case UNPAUSE:
				streamSession.SetPaused(false)
			case PAUSE, SKIP:
				streamSession.SetPaused(true)
			case SIGNAL:
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
