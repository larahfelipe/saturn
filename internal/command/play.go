package command

import (
	"fmt"

	"github.com/larahfelipe/saturn/internal/bot"
	"github.com/larahfelipe/saturn/internal/music"
	"go.uber.org/zap"
)

func playSongCommand(bot *bot.Bot, m *bot.Message) {
	if len(m.args) == 0 {
		bot.Session.ChannelMessageSendEmbedReply(m.ChannelID, bot.BuildErrorMessageEmbed("Guess you forgot to provide a song url"), m.Reference())
		zap.L().Info(fmt.Sprintf("%s didn't provide a song url", m.Author.Username))
		return
	}

	songUrl := m.args[0]

	v, err := bot.Feature.External.Youtube.GetVideo(songUrl)
	if err != nil {
		bot.Session.ChannelMessageSendEmbedReply(m.ChannelID, bot.BuildErrorMessageEmbed("It seems something went wrong while searching for your song"), m.Reference())
		zap.L().Error(fmt.Sprintf("youtube video request error: %s", err))
		return
	}

	av := v.Formats.WithAudioChannels()[0]
	rs, _, err := bot.Feature.External.Youtube.GetStream(v, &av)
	if err != nil {
		bot.Session.ChannelMessageSendEmbedReply(m.ChannelID, bot.BuildErrorMessageEmbed("It seems something went wrong while searching for your song"), m.Reference())
		zap.L().Error(fmt.Sprintf("youtube stream request error: %s", err))
		return
	}

	mq := bot.Feature.MusicQueue

	mq.Mutex.Lock()
	defer mq.Mutex.Unlock()

	song := &music.Song{
		Title:       v.Title,
		Url:         songUrl,
		ArtworkUrl:  v.Thumbnails[0].URL,
		Duration:    v.Duration.String(),
		RequestedBy: m.Author.ID,
		Position:    len(mq.Songs) + 1,
		StreamData: &music.StreamData{
			Url:          av.URL,
			MimeType:     av.MimeType,
			AudioQuality: av.AudioQuality,
			Bitrate:      av.Bitrate,
			Readable:     rs,
		},
	}

	mq.Add(song)

	sme := song.BuildMessageEmbed(mq.IsPlaying)

	if !mq.IsPlaying {
		if mq.VoiceConnection == nil {
			vc, err := bot.MakeVoiceConnection(m)
			if err != nil {
				bot.Session.ChannelMessageSendEmbed(m.ChannelID, bot.BuildErrorMessageEmbed("It seems that I'm not in the mood for partying right now. Maybe later?"))
				zap.L().Error(fmt.Sprintf("voice connection error: %s", err))
				return
			}

			mq.VoiceConnection = vc
		}

		mq.IsPlaying = true
		mq.PlaybackState <- music.PLAY
	}

	bot.Session.ChannelMessageSendEmbed(m.ChannelID, sme)
}
