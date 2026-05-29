package commands

import (
	"fmt"
	"math"
	"net/url"
	"strings"

	dg "github.com/bwmarrin/discordgo"
	yt "github.com/kkdai/youtube/v2"
	"github.com/larahfelipe/saturn/internal/command"
	"github.com/larahfelipe/saturn/internal/discord"
	"github.com/larahfelipe/saturn/internal/player"
	"github.com/larahfelipe/saturn/internal/youtube"
)

// Play constructs the play song command handler.
func Play(bot *discord.Bot, registry *player.Registry, ytClient *yt.Client) command.HandlerFunc {
	return func(s *dg.Session, m *dg.MessageCreate, args []string) error {
		if len(args) == 0 {
			bot.SendReplyMessageEmbed(m.Message, bot.BuildErrorMessageEmbed("Missing song url. Forgot to provide it?"))
			return youtube.ErrMissingYoutubeVideoUrl
		}

		videoUrl := args[0]
		parsedUrl, err := url.Parse(videoUrl)
		if err != nil || parsedUrl.Scheme != "https" || !isValidYoutubeHost(parsedUrl.Host) {
			bot.SendReplyMessageEmbed(m.Message, bot.BuildErrorMessageEmbed("Invalid YouTube URL. Please provide a valid YouTube link"))
			return fmt.Errorf("invalid youtube url: %s", videoUrl)
		}

		videoMetadata, err := ytClient.GetVideo(videoUrl)
		if err != nil {
			bot.SendReplyMessageEmbed(m.Message, bot.BuildErrorMessageEmbed("Something went wrong while searching your song. Please, try again later"))
			return fmt.Errorf("youtube video request error: %w", err)
		}

		audioFormats := videoMetadata.Formats.WithAudioChannels()
		if len(audioFormats) == 0 {
			bot.SendReplyMessageEmbed(m.Message, bot.BuildErrorMessageEmbed("No suitable audio track was found for this video"))
			return fmt.Errorf("no audio formats found for video: %s", videoMetadata.Title)
		}
		videoFormat := audioFormats[0]
		audioStream, _, err := ytClient.GetStream(videoMetadata, &videoFormat)
		if err != nil {
			bot.SendReplyMessageEmbed(m.Message, bot.BuildErrorMessageEmbed("Something went wrong while retrieving your song. Please, try again later"))
			return fmt.Errorf("youtube stream request error: %w", err)
		}

		queue := registry.Get(m.GuildID)

		song := &player.Song{
			Url:         videoUrl,
			Title:       videoMetadata.Title,
			ArtworkUrl:  videoMetadata.Thumbnails[0].URL,
			Duration:    videoMetadata.Duration.String(),
			Position:    queue.GetSongCount() + 1,
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

		songMsgEmbed := song.BuildMessageEmbed(!queue.IsIdle())

		if queue.IsIdle() {
			if queue.GetVoiceConnection() == nil {
				voice, err := bot.JoinVoiceChannel(m.GuildID, m.Author.ID)
				if err != nil {
					bot.SendMessageEmbed(m.Message, bot.BuildErrorMessageEmbed("Something went wrong while trying to join the party. Please, try again later"))
					return fmt.Errorf("voice connection error: %w", err)
				}

				bot.SendMessageEmbed(m.Message, bot.BuildMessageEmbed(fmt.Sprintf("Yay! Joining the party on <#%s>", voice.Channel.ID)))
				queue.StartPlayback(voice)
			} else {
				queue.StartPlayback(nil)
			}
		}

		bot.SendMessageEmbed(m.Message, songMsgEmbed)

		return nil
	}
}

func isValidYoutubeHost(host string) bool {
	host = strings.ToLower(host)
	return host == "youtube.com" ||
		host == "www.youtube.com" ||
		host == "m.youtube.com" ||
		host == "youtu.be"
}
