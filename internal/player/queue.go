package player

import (
	"fmt"
	"sync"
	"time"

	"go.uber.org/zap"

	dg "github.com/bwmarrin/discordgo"
	"github.com/larahfelipe/saturn/internal/config"
	"github.com/larahfelipe/saturn/internal/util"
)

type Voice struct {
	Connection *dg.VoiceConnection
	Channel    *dg.Channel
}

type Queue struct {
	Idle          bool
	Mutex         sync.RWMutex
	PlaybackState chan PlaybackState
	Voice         *Voice
	Songs         []Song
}

type PlaybackState int

var (
	once     sync.Once
	instance *Queue
)

const (
	IDLE PlaybackState = iota
	PLAY
	PAUSE
	UNPAUSE
	SKIP
	EOF // indicates the end of a stream session
	ERR // indicates a stream session error
)

const QueueSleepInterval = 100 * time.Millisecond // 100ms

func newQueue() *Queue {
	return &Queue{
		Idle:          true,
		Voice:         &Voice{},
		Songs:         []Song{},
		PlaybackState: make(chan PlaybackState, 5),
	}
}

// GetInstance returns the singleton instance of `Queue`.
func GetInstance() *Queue {
	once.Do(func() {
		instance = newQueue()
	})

	return instance
}

// Shift pops out the first song of the queue.
func (q *Queue) Shift() *Song {
	if len(q.Songs) == 0 {
		return nil
	}

	song := q.Songs[0]
	q.Songs = q.Songs[1:]

	return &song
}

// Cleanup resets the queue to its default state.
func (q *Queue) Reset(cleanupAndShutdown bool) {
	q.Mutex.Lock()
	defer q.Mutex.Unlock()

	if q.Voice.Connection != nil {
		if err := q.Voice.Connection.Disconnect(); err != nil {
			zap.L().Error("voice connection disconnect error", zap.Error(err))
		}
	}

	q.Voice = &Voice{}
	q.Songs = []Song{}
	q.Idle = true

	if cleanupAndShutdown {
		if err := util.DeleteDir(config.GetAppDownloadsDirName()); err != nil {
			zap.L().Info(fmt.Sprintf("`%s` directory was not found, skipping", config.GetAppDownloadsDirName()))
		}

		if q.PlaybackState != nil {
			close(q.PlaybackState)
		}
	}
}

// Add adds a new song to the queue and returns his index.
func (q *Queue) Add(song *Song) int {
	q.Songs = append(q.Songs, *song)

	return len(q.Songs) - 1
}

// Process manages the queue's playback state.
func (q *Queue) Process() {
	streamSessionChan := make(chan StreamSessionResult)
	defer close(streamSessionChan)

	for {
		select {
		case playbackState := <-q.PlaybackState:
			switch playbackState {
			case IDLE:
				q.Reset(false)

			case PLAY:
				if song := q.Shift(); song != nil {
					go (&StreamSession{
						Song: song,
						VoiceChannel: &VoiceChannel{
							Connection: q.Voice.Connection,
							Bitrate:    q.Voice.Channel.Bitrate,
						},
					}).Stream(streamSessionChan)
				} else {
					q.PlaybackState <- IDLE
				}

			case PAUSE, UNPAUSE, SKIP:
				streamSessionChan <- StreamSessionResult{State: playbackState}
				if playbackState == SKIP {
					q.PlaybackState <- PLAY
				}
			}

		case streamSessionResult := <-streamSessionChan:
			if streamSessionResult.State == EOF {
				q.PlaybackState <- PLAY
			} else if streamSessionResult.State == ERR {
				zap.L().Error("stream session result received an error", zap.Error(streamSessionResult.Error))
				q.PlaybackState <- IDLE
			}

		default:
			// prevent cpu spinning by sleeping for a short interval
			time.Sleep(QueueSleepInterval)
		}
	}
}
