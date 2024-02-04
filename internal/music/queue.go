package music

import (
	"fmt"
	"sync"
	"time"

	"github.com/bwmarrin/discordgo"
	"go.uber.org/zap"

	"github.com/larahfelipe/saturn/internal/util"
)

type PlaybackState int

const (
	IDLE PlaybackState = iota
	PLAY
	PAUSE
	UNPAUSE
	SKIP
	SIGNAL // used to signal the end of a stream session
)

type Queue struct {
	IsPlaying       bool
	Mutex           sync.RWMutex
	PlaybackState   chan PlaybackState
	VoiceConnection *discordgo.VoiceConnection
	Songs           []Song
}

func New() *Queue {
	return &Queue{
		PlaybackState: make(chan PlaybackState, 5),
		Songs:         []Song{},
	}
}

func (q *Queue) Shift() *Song {
	if len(q.Songs) == 0 {
		return nil
	}

	s := q.Songs[0]
	q.Songs = q.Songs[1:]

	return &s
}

func (q *Queue) Cleanup(closeChan bool) {
	if q.VoiceConnection != nil {
		if err := q.VoiceConnection.Disconnect(); err != nil {
			zap.L().Error(fmt.Sprintf("voice connection disconnect error: %s", err))
		}

		q.VoiceConnection.Close()
		q.VoiceConnection = nil
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

func (q *Queue) Add(song *Song) {
	q.Songs = append(q.Songs, *song)
}

func (q *Queue) Process() {
	ssChan := make(chan StreamSession)
	defer close(ssChan)

	for {
		select {
		case ps := <-q.PlaybackState:
			switch ps {
			case IDLE:
				if len(q.Songs) == 0 && q.VoiceConnection != nil {
					q.Cleanup(false)
				}

			case PLAY:
				if len(q.Songs) == 0 {
					q.IsPlaying = false
					q.PlaybackState <- IDLE
				}
				song := q.Shift()
				if song != nil {
					s := &Stream{
						Song:            song,
						VoiceConnection: q.VoiceConnection,
					}
					go s.Stream(ssChan)
				}

			case PAUSE, UNPAUSE:
				ssChan <- StreamSession{State: ps}

			case SKIP:
				ssChan <- StreamSession{State: SKIP}
				q.PlaybackState <- PLAY
			}

		case ssr := <-ssChan:
			q.Mutex.Lock()
			if ssr.Error != nil {
				zap.L().Error(ssr.Error.Error())
				q.Cleanup(false)
			}
			if ssr.State == SIGNAL {
				q.PlaybackState <- PLAY
			}
			q.Mutex.Unlock()

		default:
			// avoids blocking if there are no messages, allows continuous listening, prevents CPU spinning
			time.Sleep(100 * time.Millisecond)
		}
	}
}
