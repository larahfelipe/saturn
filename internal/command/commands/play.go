package commands

import (
	"fmt"
	"math"

	yt "github.com/kkdai/youtube/v2"
	"github.com/larahfelipe/saturn/internal/bot"
	"github.com/larahfelipe/saturn/internal/command"
	"github.com/larahfelipe/saturn/internal/common"
	"github.com/larahfelipe/saturn/internal/player"
)

type PlaySongCommand struct {
	*command.BaseCommand
	Bot     *bot.Bot
	Queue   *player.Queue
	Youtube *yt.Client
}

func NewPlaySongCommand(bot *bot.Bot, queue *player.Queue, yt *yt.Client) *PlaySongCommand {
	return &PlaySongCommand{
		BaseCommand: command.NewBaseCommand("play", "Play a song", true),
		Bot:         bot,
		Queue:       queue,
		Youtube:     yt,
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
	if len(m.Args) == 0 {
		psc.Bot.DS.SendReplyMessageEmbed(m.Message, psc.Bot.DS.BuildErrorMessageEmbed("Missing song url. Forgot to provide it?"))
		return common.ErrMissingYoutubeVideoUrl
	}

	videoUrl := m.Args[0]
	videoMetadata, err := psc.Youtube.GetVideo(videoUrl)
	if err != nil {
		psc.Bot.DS.SendReplyMessageEmbed(m.Message, psc.Bot.DS.BuildErrorMessageEmbed("Something went wrong while searching your song. Please, try again later"))
		return fmt.Errorf("youtube video request error: %s", err)
	}

	videoFormat := videoMetadata.Formats.WithAudioChannels()[0]
	audioStream, _, err := psc.Youtube.GetStream(videoMetadata, &videoFormat)
	if err != nil {
		psc.Bot.DS.SendReplyMessageEmbed(m.Message, psc.Bot.DS.BuildErrorMessageEmbed("Something went wrong while retrieving your song. Please, try again later"))
		return fmt.Errorf("youtube stream request error: %s", err)
	}

	song := &player.Song{
		Url:         videoUrl,
		Title:       videoMetadata.Title,
		ArtworkUrl:  videoMetadata.Thumbnails[0].URL,
		Duration:    videoMetadata.Duration.String(),
		Position:    len(psc.Queue.Songs) + 1,
		RequestedBy: m.Author.ID,
		Stream: &player.Stream{
			Url:          videoFormat.URL,
			MimeType:     videoFormat.MimeType,
			AudioQuality: videoFormat.AudioQuality,
			Bitrate:      videoFormat.Bitrate / int(math.Pow10(3)),
			Readable:     audioStream,
		},
	}
	psc.Queue.Add(song)

	songMsgEmbed := song.BuildMessageEmbed(!psc.Queue.Idle)

	if psc.Queue.Idle {
		if psc.Queue.Voice.Connection == nil {
			voice, err := psc.Bot.MakeVoiceConnection(m.Message.Author.ID)
			if err != nil {
				psc.Bot.DS.SendMessageEmbed(m.Message, psc.Bot.DS.BuildErrorMessageEmbed("Something went wrong while trying to join the party. Please, try again later"))
				return fmt.Errorf("voice connection error: %s", err)
			}

			psc.Bot.DS.SendMessageEmbed(m.Message, psc.Bot.DS.BuildMessageEmbed(fmt.Sprintf("Yay! Joining the party on <#%s>", voice.Channel.ID)))

			psc.Queue.Voice = voice
		}
		psc.Queue.Idle = false
		psc.Queue.PlaybackState <- player.PLAY
	}

	psc.Bot.DS.SendMessageEmbed(m.Message, songMsgEmbed)

	return nil
}
