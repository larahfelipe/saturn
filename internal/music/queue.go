package music

import (
	"fmt"
	"sync"
	"time"

	"github.com/bwmarrin/discordgo"
	"go.uber.org/zap"

	"github.com/larahfelipe/saturn/internal/utils"
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

type MusicQueue struct {
	IsPlaying       bool
	Mutex           sync.RWMutex
	PlaybackState   chan PlaybackState
	VoiceConnection *discordgo.VoiceConnection
	Songs           []Song
}

func (mq *MusicQueue) Shift() *Song {
	if len(mq.Songs) == 0 {
		return nil
	}

	s := mq.Songs[0]
	mq.Songs = mq.Songs[1:]

	return &s
}

func (mq *MusicQueue) Cleanup(closeChan bool) {
	if mq.VoiceConnection != nil {
		if err := mq.VoiceConnection.Disconnect(); err != nil {
			zap.L().Error(fmt.Sprintf("voice connection disconnect error: %s", err))
		}

		mq.VoiceConnection.Close()
		mq.VoiceConnection = nil
	}

	mq.IsPlaying = false
	mq.Songs = []Song{}

	if err := utils.DeleteDir("temp"); err != nil {
		zap.L().Info("temp directory not found, ignoring removal")
	}

	if closeChan {
		close(mq.PlaybackState)
	}
}

func (mq *MusicQueue) Add(song *Song) {
	mq.Songs = append(mq.Songs, *song)
}

func (mq *MusicQueue) Process() {
	ssChan := make(chan StreamSession)
	defer close(ssChan)

	for {
		select {
		case ps := <-mq.PlaybackState:
			switch ps {
			case IDLE:
				if len(mq.Songs) == 0 && mq.VoiceConnection != nil {
					mq.Cleanup(false)
				}

			case PLAY:
				if len(mq.Songs) == 0 {
					mq.IsPlaying = false
					mq.PlaybackState <- IDLE
				}
				song := mq.Shift()
				if song != nil {
					s := &Stream{
						Song:            song,
						VoiceConnection: mq.VoiceConnection,
					}
					go s.Stream(ssChan)
				}

			case PAUSE, UNPAUSE:
				ssChan <- StreamSession{State: ps}

			case SKIP:
				ssChan <- StreamSession{State: SKIP}
				mq.PlaybackState <- PLAY
			}

		case ssr := <-ssChan:
			mq.Mutex.Lock()
			if ssr.Error != nil {
				zap.L().Error(ssr.Error.Error())
				mq.Cleanup(false)
			}
			if ssr.State == SIGNAL {
				mq.PlaybackState <- PLAY
			}
			mq.Mutex.Unlock()

		default:
			// avoids blocking if there are no messages, allows continuous listening, prevents CPU spinning
			time.Sleep(100 * time.Millisecond)
		}
	}
}
