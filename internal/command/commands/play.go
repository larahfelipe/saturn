package commands

import (
	"fmt"
	"math"

	"github.com/larahfelipe/saturn/internal/bot"
	"github.com/larahfelipe/saturn/internal/command"
	"github.com/larahfelipe/saturn/internal/common"
	"github.com/larahfelipe/saturn/internal/player"
	"github.com/larahfelipe/saturn/internal/youtube"
)

type PlaySongCommand struct {
	*command.BaseCommand
}

func NewPlaySongCommand() *PlaySongCommand {
	return &PlaySongCommand{
		BaseCommand: command.NewBaseCommand("play", "Play a song", true),
	}
}

func (psc *PlaySongCommand) Active() bool {
	return psc.BaseCommand.Active
}

func (psc *PlaySongCommand) Name() string {
	return psc.BaseCommand.Name
}

func (psc *PlaySongCommand) Help() string {
	return psc.BaseCommand.Help
}

func (psc *PlaySongCommand) Execute(m *command.Message) error {
	bot := bot.GetInstance()
	youtube := youtube.GetInstance()

	if len(m.Args) == 0 {
		bot.DS.SendReplyMessageEmbed(m.Message, bot.DS.BuildErrorMessageEmbed("Missing song url. Forgot to provide it?"))
		return common.ErrMissingYoutubeVideoUrl
	}

	videoUrl := m.Args[0]
	videoMetadata, err := youtube.GetVideo(videoUrl)
	if err != nil {
		bot.DS.SendReplyMessageEmbed(m.Message, bot.DS.BuildErrorMessageEmbed("Something went wrong while searching your song. Please, try again later"))
		return fmt.Errorf("youtube video request error: %s", err)
	}

	videoFormat := videoMetadata.Formats.WithAudioChannels()[0]
	audioStream, _, err := youtube.GetStream(videoMetadata, &videoFormat)
	if err != nil {
		bot.DS.SendReplyMessageEmbed(m.Message, bot.DS.BuildErrorMessageEmbed("Something went wrong while retrieving your song. Please, try again later"))
		return fmt.Errorf("youtube stream request error: %s", err)
	}

	queue := player.GetInstance()
	queue.Mutex.Lock()
	defer queue.Mutex.Unlock()

	song := &player.Song{
		Url:         videoUrl,
		Title:       videoMetadata.Title,
		ArtworkUrl:  videoMetadata.Thumbnails[0].URL,
		Duration:    videoMetadata.Duration.String(),
		Position:    len(queue.Songs) + 1,
		RequestedBy: m.Author.ID,
		Stream: &player.Stream{
			Url:          videoFormat.URL,
			MimeType:     videoFormat.MimeType,
			AudioQuality: videoFormat.AudioQuality,
			Bitrate:      videoFormat.Bitrate / int(math.Pow10(3)),
			Readable:     audioStream,
		},
	}
	queue.Add(song)

	songMsgEmbed := song.BuildMessageEmbed(!queue.Idle)

	if queue.Idle {
		if queue.Voice.Connection == nil {
			voice, err := bot.MakeVoiceConnection(m.Message.Author.ID)
			if err != nil {
				bot.DS.SendMessageEmbed(m.Message, bot.DS.BuildErrorMessageEmbed("Something went wrong while trying to join the party. Please, try again later"))
				return fmt.Errorf("voice connection error: %s", err)
			}

			bot.DS.SendMessageEmbed(m.Message, bot.DS.BuildMessageEmbed(fmt.Sprintf("Yay! Joining the party on <#%s>", voice.Channel.ID)))

			queue.Voice = voice
		}
		queue.Idle = false
		queue.PlaybackState <- player.PLAY
	}

	bot.DS.SendMessageEmbed(m.Message, songMsgEmbed)

	return nil
}
