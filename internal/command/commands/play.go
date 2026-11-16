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
	"go.uber.org/zap"
)

// Play constructs the play song command handler.
func Play(bot *discord.Bot, registry *player.Registry, ytClient *yt.Client) command.HandlerFunc {
	return func(s *dg.Session, i *dg.InteractionCreate) error {
		options := i.ApplicationCommandData().Options
		var videoUrl string
		for _, opt := range options {
			if opt.Name == "url" {
				videoUrl = opt.StringValue()
				break
			}
		}

		if videoUrl == "" {
			bot.RespondEmbed(i.Interaction, bot.BuildErrorMessageEmbed("Missing song url option"))
			return fmt.Errorf("missing youtube url option")
		}

		parsedUrl, err := url.Parse(videoUrl)
		if err != nil || parsedUrl.Scheme != "https" || !isValidYoutubeHost(parsedUrl.Host) {
			bot.RespondEmbed(i.Interaction, bot.BuildErrorMessageEmbed("Invalid YouTube URL. Please provide a valid YouTube link"))
			return fmt.Errorf("invalid youtube url: %s", videoUrl)
		}

		// Defer response immediately to avoid 3-second gateway timeout
		err = s.InteractionRespond(i.Interaction, &dg.InteractionResponse{
			Type: dg.InteractionResponseDeferredChannelMessageWithSource,
		})
		if err != nil {
			bot.Logger.Error("failed to defer play command response", zap.Error(err))
			return err
		}

		// Perform YouTube loading asynchronously
		go func() {
			videoMetadata, err := ytClient.GetVideo(videoUrl)
			if err != nil {
				bot.FollowupError(i.Interaction, "Something went wrong while searching your song. Please, try again later")
				bot.Logger.Error("youtube video request error", zap.Error(err))
				return
			}

			audioFormats := videoMetadata.Formats.WithAudioChannels()
			if len(audioFormats) == 0 {
				bot.FollowupError(i.Interaction, "No suitable audio track was found for this video")
				bot.Logger.Error("no audio formats found", zap.String("title", videoMetadata.Title))
				return
			}
			videoFormat := audioFormats[0]
			audioStream, _, err := ytClient.GetStream(videoMetadata, &videoFormat)
			if err != nil {
				bot.FollowupError(i.Interaction, "Something went wrong while retrieving your song. Please, try again later")
				bot.Logger.Error("youtube stream request error", zap.Error(err))
				return
			}

			queue := registry.Get(i.GuildID)

			song := &player.Song{
				Url:         videoUrl,
				Title:       videoMetadata.Title,
				ArtworkUrl:  videoMetadata.Thumbnails[0].URL,
				Duration:    videoMetadata.Duration.String(),
				Position:    queue.GetSongCount() + 1,
				RequestedBy: i.Member.User.ID,
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

			// Serialize voice channel join and playback triggers under the queue lock
			err = queue.StartPlaybackWithVoiceJoin(func() (*player.Voice, error) {
				return bot.JoinVoiceChannel(i.GuildID, i.Member.User.ID)
			})
			if err != nil {
				bot.FollowupError(i.Interaction, "Something went wrong while trying to join the party. Please, try again later")
				bot.Logger.Error("voice connection error", zap.Error(err))
				return
			}

			bot.FollowupEmbedWithButtons(i.Interaction, songMsgEmbed)
		}()

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
