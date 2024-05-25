package music

import (
	"fmt"
	"sync"
	"time"

	"go.uber.org/zap"

	"github.com/bwmarrin/discordgo"
	"github.com/larahfelipe/saturn/internal/util"
)

type PlaybackState int

const (
	IDLE PlaybackState = iota
	PLAY
	PAUSE
	UNPAUSE
	SKIP
	SIGNAL // indicates the end of a stream session
)

type Voice struct {
	Connection *discordgo.VoiceConnection
	Channel    *discordgo.Channel
}

type Queue struct {
	IsPlaying     bool
	Mutex         sync.RWMutex
	PlaybackState chan PlaybackState
	Voice         *Voice
	Songs         []Song
}

// New creates a new music queue instance.
func New() *Queue {
	return &Queue{
		PlaybackState: make(chan PlaybackState, 5),
		Voice:         &Voice{},
		Songs:         []Song{},
	}
}

// Shift pops out the first song of the queue.
func (q *Queue) Shift() *Song {
	if len(q.Songs) == 0 {
		return nil
	}

	s := q.Songs[0]
	q.Songs = q.Songs[1:]

	return &s
}

// Cleanup resets the queue to its default state.
func (q *Queue) Cleanup(closeChan bool) {
	if q.Voice.Connection != nil {
		if err := q.Voice.Connection.Disconnect(); err != nil {
			zap.L().Error(fmt.Sprintf("voice connection disconnect error: %s", err))
		}

		q.Voice.Connection.Close()
		q.Voice = nil
	}

	q.IsPlaying = false
	q.Songs = []Song{}

	if err := util.DeleteDir("temp"); err != nil {
		zap.L().Info("temp directory not found, ignoring removal")
	}

	if closeChan {
		close(q.PlaybackState)
	}
}

// Add adds a new song to the queue and returns his index.
func (q *Queue) Add(song *Song) int {
	q.Songs = append(q.Songs, *song)

	return len(q.Songs) - 1
}

// Process manages the queue's playback state.
func (q *Queue) Process() {
	ssChan := make(chan StreamSession)
	defer close(ssChan)

	for {
		select {
		case ps := <-q.PlaybackState:
			switch ps {
			case IDLE:
				if len(q.Songs) == 0 && q.Voice.Connection != nil {
					q.Cleanup(false)
				}

			case PLAY:
				if len(q.Songs) == 0 {
					q.IsPlaying = false
					q.PlaybackState <- IDLE
				}
				if song := q.Shift(); song != nil {
					go (&Stream{
						Song: song,
						VoiceChannel: &VoiceChannel{
							Connection: q.Voice.Connection,
							Bitrate:    q.Voice.Channel.Bitrate,
						},
					}).Stream(ssChan)
				}

			case PAUSE, UNPAUSE, SKIP:
				ssChan <- StreamSession{State: ps}
				if ps == SKIP {
					q.PlaybackState <- PLAY
				}
			}

		case ssr := <-ssChan:
			q.Mutex.Lock()
			if ssr.Error != nil {
				zap.L().Error(ssr.Error.Error())
				q.Cleanup(false)
			} else if ssr.State == SIGNAL {
				q.PlaybackState <- PLAY
			}
			q.Mutex.Unlock()

		default:
			// avoids blocking if there are no messages, allows continuous listening, prevents CPU spinning
			time.Sleep(100 * time.Millisecond)
		}
	}
}
