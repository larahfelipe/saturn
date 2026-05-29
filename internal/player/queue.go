package player

import (
	"sync"

	dg "github.com/bwmarrin/discordgo"
	"github.com/larahfelipe/saturn/internal/config"
	"go.uber.org/zap"
)

type Voice struct {
	Connection *dg.VoiceConnection
	Channel    *dg.Channel
}

type Queue struct {
	mutex         sync.RWMutex
	idle          bool
	playbackState chan PlaybackState
	voice         *Voice
	songs         []Song
	config        *config.Config
	logger        *zap.Logger
	controlChan   chan PlaybackState
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

func (p PlaybackState) String() string {
	switch p {
	case IDLE:
		return "IDLE"
	case PLAY:
		return "PLAY"
	case PAUSE:
		return "PAUSE"
	case UNPAUSE:
		return "UNPAUSE"
	case SKIP:
		return "SKIP"
	case EOF:
		return "EOF"
	case ERR:
		return "ERR"
	default:
		return "UNKNOWN"
	}
}

func New(cfg *config.Config, logger *zap.Logger) *Queue {
	return &Queue{
		idle:          true,
		voice:         &Voice{},
		songs:         []Song{},
		playbackState: make(chan PlaybackState, 10),
		config:        cfg,
		logger:        logger,
	}
}

// IsIdle returns whether the player queue is currently idle.
func (queue *Queue) IsIdle() bool {
	queue.mutex.RLock()
	defer queue.mutex.RUnlock()
	return queue.idle
}

// GetSongCount returns the total number of songs in the queue.
func (queue *Queue) GetSongCount() int {
	queue.mutex.RLock()
	defer queue.mutex.RUnlock()
	return len(queue.songs)
}

// Add appends a new song to the queue and returns its 0-indexed position.
func (queue *Queue) Add(song *Song) int {
	queue.mutex.Lock()
	defer queue.mutex.Unlock()
	queue.songs = append(queue.songs, *song)
	return len(queue.songs) - 1
}

// Shift removes and returns the first song of the queue.
func (queue *Queue) Shift() *Song {
	queue.mutex.Lock()
	defer queue.mutex.Unlock()
	return queue.songsPopUnlocked()
}

func (queue *Queue) songsPopUnlocked() *Song {
	if len(queue.songs) == 0 {
		return nil
	}
	song := queue.songs[0]
	queue.songs = queue.songs[1:]
	return &song
}

// GetVoiceConnection returns the current voice connection safely.
func (queue *Queue) GetVoiceConnection() *dg.VoiceConnection {
	queue.mutex.RLock()
	defer queue.mutex.RUnlock()
	return queue.voice.Connection
}

// GetVoiceChannelID returns the voice channel ID if connected.
func (queue *Queue) GetVoiceChannelID() string {
	queue.mutex.RLock()
	defer queue.mutex.RUnlock()
	if queue.voice.Channel != nil {
		return queue.voice.Channel.ID
	}
	return ""
}

// StartPlayback initializes voice connection state and triggers song processing.
func (queue *Queue) StartPlayback(voice *Voice) {
	queue.mutex.Lock()
	queue.voice = voice
	queue.idle = false
	queue.mutex.Unlock()

	queue.playbackState <- PLAY
}

// Pause pauses song streaming if active.
func (queue *Queue) Pause() bool {
	queue.mutex.RLock()
	idle := queue.idle
	queue.mutex.RUnlock()
	if idle {
		return false
	}
	queue.playbackState <- PAUSE
	return true
}

// Unpause resumes song streaming if active.
func (queue *Queue) Unpause() bool {
	queue.mutex.RLock()
	idle := queue.idle
	queue.mutex.RUnlock()
	if idle {
		return false
	}
	queue.playbackState <- UNPAUSE
	return true
}

// Skip skips the currently playing song if active.
func (queue *Queue) Skip() bool {
	queue.mutex.RLock()
	idle := queue.idle
	queue.mutex.RUnlock()
	if idle {
		return false
	}
	queue.playbackState <- SKIP
	return true
}

// Stop stops the song playback and resets queue state.
func (queue *Queue) Stop() bool {
	queue.mutex.RLock()
	idle := queue.idle
	queue.mutex.RUnlock()
	if idle {
		return false
	}
	queue.playbackState <- IDLE
	return true
}

// Reset clears the queue and disconnects from voice channels.
func (queue *Queue) Reset() {
	queue.mutex.Lock()
	defer queue.mutex.Unlock()
	queue.resetUnlocked()
}

func (queue *Queue) resetUnlocked() {
	if queue.voice.Connection != nil {
		if err := queue.voice.Connection.Disconnect(); err != nil {
			queue.logger.Error("voice connection disconnect error", zap.Error(err))
		}
	}
	queue.voice = &Voice{}
	queue.songs = []Song{}
	queue.idle = true
	queue.controlChan = nil
}

// Process handles queue and stream lifecycle.
func (queue *Queue) Process() {
	for {
		select {
		case playbackState := <-queue.playbackState:
			queue.mutex.Lock()
			switch playbackState {
			case IDLE:
				queue.resetUnlocked()
				queue.mutex.Unlock()

			case PLAY:
				song := queue.songsPopUnlocked()
				if song != nil {
					queue.controlChan = make(chan PlaybackState, 10)
					controlChan := queue.controlChan
					queue.idle = false

					voiceConn := queue.voice.Connection
					var bitrate int
					if queue.voice.Channel != nil {
						bitrate = queue.voice.Channel.Bitrate
					}
					queue.mutex.Unlock()

					go func() {
						err := (&StreamSession{
							Song: song,
							VoiceChannel: &VoiceChannel{
								Connection: voiceConn,
								Bitrate:    bitrate,
							},
						}).Stream(controlChan)

						if err != nil {
							queue.logger.Error("stream session error", zap.Error(err))
							queue.playbackState <- IDLE
						} else {
							queue.playbackState <- PLAY
						}
					}()
				} else {
					queue.idle = true
					queue.resetUnlocked()
					queue.mutex.Unlock()
				}

			case PAUSE, UNPAUSE, SKIP:
				if queue.controlChan != nil {
					select {
					case queue.controlChan <- playbackState:
					default:
						queue.logger.Warn("control channel buffer full, dropping signal", zap.String("state", playbackState.String()))
					}
				}
				queue.mutex.Unlock()
			}
		}
	}
}

// Registry manages thread-safe mapping of guild-level player instances.
type Registry struct {
	mutex   sync.RWMutex
	players map[string]*Queue
	config  *config.Config
	logger  *zap.Logger
}

// NewRegistry instantiates a new player registry.
func NewRegistry(cfg *config.Config, logger *zap.Logger) *Registry {
	return &Registry{
		players: make(map[string]*Queue),
		config:  cfg,
		logger:  logger,
	}
}

// Get retrieves or spawns a guild player instance.
func (r *Registry) Get(guildID string) *Queue {
	r.mutex.Lock()
	defer r.mutex.Unlock()

	q, exists := r.players[guildID]
	if !exists {
		q = New(r.config, r.logger)
		r.players[guildID] = q
		go q.Process()
	}
	return q
}

// ResetAll resets and disconnects all registry player instances.
func (r *Registry) ResetAll() {
	r.mutex.Lock()
	defer r.mutex.Unlock()
	for _, q := range r.players {
		q.Reset()
	}
}
