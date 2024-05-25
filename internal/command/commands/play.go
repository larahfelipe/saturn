package commands

import (
	"fmt"

	"github.com/bwmarrin/discordgo"
	"github.com/larahfelipe/saturn/internal/bot"
	"github.com/larahfelipe/saturn/internal/command"
	"github.com/larahfelipe/saturn/internal/common"
	"github.com/larahfelipe/saturn/internal/music"
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

func (psc *PlaySongCommand) Execute(bot *bot.Bot, m *command.Message) error {
	if len(m.Args) == 0 {
		bot.Session.ChannelMessageSendEmbedReply(m.ChannelID, bot.BuildErrorMessageEmbed("Guess you forgot to provide a song url"), m.Reference())
		return common.ErrMissingYoutubeUrl
	}

	url := m.Args[0]
	video, err := bot.Module.Extension.Youtube.GetVideo(url)
	if err != nil {
		bot.Session.ChannelMessageSendEmbedReply(m.ChannelID, bot.BuildErrorMessageEmbed("It seems something went wrong while searching for your song"), m.Reference())
		return fmt.Errorf("youtube video request error: %s", err)
	}

	vf := video.Formats.WithAudioChannels()[0]
	rs, _, err := bot.Module.Extension.Youtube.GetStream(video, &vf)
	if err != nil {
		bot.Session.ChannelMessageSendEmbedReply(m.ChannelID, bot.BuildErrorMessageEmbed("It seems something went wrong while searching for your song"), m.Reference())
		return fmt.Errorf("youtube stream request error: %s", err)
	}

	queue := bot.Module.Queue
	queue.Mutex.Lock()
	defer queue.Mutex.Unlock()

	song := &music.Song{
		Title:       video.Title,
		Url:         url,
		ArtworkUrl:  video.Thumbnails[0].URL,
		Duration:    video.Duration.String(),
		RequestedBy: m.Author.ID,
		Position:    len(queue.Songs) + 1,
		StreamData: &music.StreamData{
			Url:          vf.URL,
			MimeType:     vf.MimeType,
			AudioQuality: vf.AudioQuality,
			Bitrate:      vf.Bitrate,
			Readable:     rs,
		},
	}
	queue.Add(song)

	sme := song.BuildMessageEmbed(queue.IsPlaying)

	if !queue.IsPlaying {
		if queue.Voice.Connection == nil {
			mv, err := bot.MakeVoiceConnection(&discordgo.MessageCreate{Message: m.Message})
			if err != nil {
				bot.Session.ChannelMessageSendEmbed(m.ChannelID, bot.BuildErrorMessageEmbed("I'm not in the best mood for partying right now. Maybe later?"))
				return fmt.Errorf("voice connection error: %s", err)
			}

			bot.Session.ChannelMessageSendEmbed(m.ChannelID, bot.BuildMessageEmbed(fmt.Sprintf("Yay! Joining the party on <#%s>", mv.Channel.ID)))

			queue.Voice = mv
		}

		queue.IsPlaying = true
		queue.PlaybackState <- music.PLAY
	}

	bot.Session.ChannelMessageSendEmbed(m.ChannelID, sme)

	return nil
}
