package player

import (
	"sync"

	"go.uber.org/zap"

	dg "github.com/bwmarrin/discordgo"
	"github.com/larahfelipe/saturn/internal/config"
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
	Config        *config.Config
	Logger        *zap.Logger
}

type PlaybackState int

const (
	IDLE PlaybackState = iota
	PLAY
	PAUSE
	UNPAUSE
	SKIP
	EOF // indicates the end of a stream session
	ERR // indicates a stream session error
)

func New(cfg *config.Config, logger *zap.Logger) *Queue {
	return &Queue{
		Idle:          true,
		Voice:         &Voice{},
		Songs:         []Song{},
		PlaybackState: make(chan PlaybackState, 5),
		Config:        cfg,
		Logger:        logger,
	}
}

// Shift pops out the first song of the queue.
func (queue *Queue) Shift() *Song {
	queue.Mutex.Lock()
	defer queue.Mutex.Unlock()

	if len(queue.Songs) == 0 {
		return nil
	}

	song := queue.Songs[0]
	queue.Songs = queue.Songs[1:]

	return &song
}

// Cleanup resets the queue to its default state.
func (queue *Queue) Reset() {
	queue.Mutex.Lock()
	defer queue.Mutex.Unlock()

	if queue.Voice.Connection != nil {
		if err := queue.Voice.Connection.Disconnect(); err != nil {
			queue.Logger.Error("voice connection disconnect error", zap.Error(err))
		}
	}

	queue.Voice = &Voice{}
	queue.Songs = []Song{}
	queue.Idle = true
}

// Add adds a new song to the queue and returns its index.
func (queue *Queue) Add(song *Song) int {
	queue.Mutex.Lock()
	defer queue.Mutex.Unlock()

	queue.Songs = append(queue.Songs, *song)

	return len(queue.Songs) - 1
}

// Process manages the queue's playback state.
func (queue *Queue) Process() {
	streamSessionChan := make(chan StreamSessionResult)

	for {
		select {
		case playbackState := <-queue.PlaybackState:
			switch playbackState {
			case IDLE:
				queue.Reset()

			case PLAY:
				song := queue.Shift()
				if song != nil {
					go (&StreamSession{
						Song: song,
						VoiceChannel: &VoiceChannel{
							Connection: queue.Voice.Connection,
							Bitrate:    queue.Voice.Channel.Bitrate,
						},
					}).Stream(streamSessionChan)
				} else {
					go func() { queue.PlaybackState <- IDLE }()
				}

			case PAUSE, UNPAUSE, SKIP:
				streamSessionChan <- StreamSessionResult{State: playbackState}
				if playbackState == SKIP {
					go func() { queue.PlaybackState <- PLAY }()
				}
			}

		case streamSessionResult := <-streamSessionChan:
			if streamSessionResult.State == EOF {
				go func() { queue.PlaybackState <- PLAY }()
			} else if streamSessionResult.State == ERR {
				queue.Logger.Error("stream session result received an error", zap.Error(streamSessionResult.Error))
				go func() { queue.PlaybackState <- IDLE }()
			}
		}
	}
}
