package player

import (
	"io"
	"math"
	"os/exec"

	dg "github.com/bwmarrin/discordgo"
	"github.com/jonas747/dca"
	"go.uber.org/zap"
)

type StreamSessionResult struct {
	Error error
	State PlaybackState
}

type VoiceChannel struct {
	Bitrate    int
	Connection *dg.VoiceConnection
}

type StreamSession struct {
	Song         *Song
	VoiceChannel *VoiceChannel
}

type Stream struct {
	Url          string
	MimeType     string
	AudioQuality string
	Bitrate      int
	Readable     io.ReadCloser
}

const MAX_BITRATE = 128 // dca only supports bitrate values between 8 and 128

// Stream streams a song on a voice channel.
func (ss *StreamSession) Stream(streamSessionChan chan StreamSessionResult) {
	if _, err := exec.LookPath("ffmpeg"); err != nil {
		streamSessionChan <- StreamSessionResult{State: ERR, Error: err}
		return
	}

	voiceChannelBitrate := ss.VoiceChannel.Bitrate / int(math.Pow10(3))
	options := dca.StdEncodeOptions
	options.RawOutput = true
	if voiceChannelBitrate <= MAX_BITRATE {
		options.Bitrate = voiceChannelBitrate
	} else if voiceChannelBitrate >= MAX_BITRATE && ss.Song.Stream.Bitrate >= MAX_BITRATE {
		options.Bitrate = MAX_BITRATE
	}

	zap.L().Debug("encoding song", zap.Reflect("song", ss.Song), zap.Reflect("encoding_options", options))

	source, err := dca.EncodeMem(ss.Song.Stream.Readable, options)
	if err != nil {
		streamSessionChan <- StreamSessionResult{State: ERR, Error: err}
		return
	}
	defer source.Cleanup()

	doneChan := make(chan error)
	defer close(doneChan)
	streaming := dca.NewStream(source, ss.VoiceChannel.Connection, doneChan)
	for {
		select {
		case streamSessionResult := <-streamSessionChan:
			switch streamSessionResult.State {
			case UNPAUSE:
				streaming.SetPaused(false)
			case PAUSE, SKIP:
				streaming.SetPaused(true)
			case EOF:
				return
			}

		// dca signals the end of a stream session by sending an io.EOF error
		case err := <-doneChan:
			if err != nil && err != io.EOF {
				streamSessionChan <- StreamSessionResult{State: ERR, Error: err}
			} else {
				streamSessionChan <- StreamSessionResult{State: EOF}
			}
			return
		}
	}
}
