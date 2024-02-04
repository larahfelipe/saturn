package commands

import (
	"fmt"

	"github.com/bwmarrin/discordgo"
	"github.com/larahfelipe/saturn/internal/bot"
	"github.com/larahfelipe/saturn/internal/command"
	"github.com/larahfelipe/saturn/internal/music"
	"go.uber.org/zap"
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

func (psc *PlaySongCommand) Execute(bot *bot.Bot, m *command.Message) {
	if len(m.Args) == 0 {
		bot.Session.ChannelMessageSendEmbedReply(m.ChannelID, bot.BuildErrorMessageEmbed("Guess you forgot to provide a song url"), m.Reference())
		zap.L().Info(fmt.Sprintf("%s didn't provide a song url", m.Author.Username))
		return
	}

	songUrl := m.Args[0]

	v, err := bot.Module.External.Youtube.GetVideo(songUrl)
	if err != nil {
		bot.Session.ChannelMessageSendEmbedReply(m.ChannelID, bot.BuildErrorMessageEmbed("It seems something went wrong while searching for your song"), m.Reference())
		zap.L().Error(fmt.Sprintf("youtube video request error: %s", err))
		return
	}

	av := v.Formats.WithAudioChannels()[0]
	rs, _, err := bot.Module.External.Youtube.GetStream(v, &av)
	if err != nil {
		bot.Session.ChannelMessageSendEmbedReply(m.ChannelID, bot.BuildErrorMessageEmbed("It seems something went wrong while searching for your song"), m.Reference())
		zap.L().Error(fmt.Sprintf("youtube stream request error: %s", err))
		return
	}

	queue := bot.Module.Queue

	queue.Mutex.Lock()
	defer queue.Mutex.Unlock()

	song := &music.Song{
		Title:       v.Title,
		Url:         songUrl,
		ArtworkUrl:  v.Thumbnails[0].URL,
		Duration:    v.Duration.String(),
		RequestedBy: m.Author.ID,
		Position:    len(queue.Songs) + 1,
		StreamData: &music.StreamData{
			Url:          av.URL,
			MimeType:     av.MimeType,
			AudioQuality: av.AudioQuality,
			Bitrate:      av.Bitrate,
			Readable:     rs,
		},
	}

	queue.Add(song)

	sme := song.BuildMessageEmbed(queue.IsPlaying)

	if !queue.IsPlaying {
		if queue.VoiceConnection == nil {
			vc, err := bot.MakeVoiceConnection(&discordgo.MessageCreate{Message: m.Message})
			if err != nil {
				bot.Session.ChannelMessageSendEmbed(m.ChannelID, bot.BuildErrorMessageEmbed("It seems that I'm not in the mood for partying right now. Maybe later?"))
				zap.L().Error(fmt.Sprintf("voice connection error: %s", err))
				return
			}

			queue.VoiceConnection = vc
		}

		queue.IsPlaying = true
		queue.PlaybackState <- music.PLAY
	}

	bot.Session.ChannelMessageSendEmbed(m.ChannelID, sme)
}
