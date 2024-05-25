package music

import (
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/bwmarrin/discordgo"

	"github.com/larahfelipe/saturn/internal/common"
	"github.com/larahfelipe/saturn/internal/util"
)

type Song struct {
	Title       string
	Url         string
	ArtworkUrl  string
	Duration    string
	RequestedBy string
	Position    int
	StreamData  *StreamData
}

// BuildMessageEmbed builds an embed message for the song.
func (song *Song) BuildMessageEmbed(queued bool) *discordgo.MessageEmbed {
	if queued {
		return &discordgo.MessageEmbed{
			Author: &discordgo.MessageEmbedAuthor{
				Name: "Queued",
			},
			Title:       song.Title,
			URL:         song.Url,
			Description: fmt.Sprintf("Added to the queue by <@%s> at position %d", song.RequestedBy, song.Position),
			Thumbnail: &discordgo.MessageEmbedThumbnail{
				URL: song.ArtworkUrl,
			},
			Footer: &discordgo.MessageEmbedFooter{
				Text: fmt.Sprintf("Duration: %s", song.Duration),
			},
			Timestamp: time.Now().Format(time.RFC3339),
			Color:     0xFFB319,
		}
	}

	return &discordgo.MessageEmbed{
		Author: &discordgo.MessageEmbedAuthor{
			Name:    "Now playing",
			IconURL: "https://github.com/larahfelipe/saturn/blob/stale-master/src/assets/cd.gif?raw=true",
		},
		Title:       song.Title,
		URL:         song.Url,
		Description: fmt.Sprintf("Requested by <@%s> Enjoy!", song.RequestedBy),
		Thumbnail: &discordgo.MessageEmbedThumbnail{
			URL: song.ArtworkUrl,
		},
		Footer: &discordgo.MessageEmbedFooter{
			Text: fmt.Sprintf("Duration: %s", song.Duration),
		},
		Color: 0x1ED760,
	}
}

// Download downloads the song.
func (song *Song) Download() (string, error) {
	defer song.StreamData.Readable.Close()

	fe := util.GetFileExtFromMime(song.StreamData.MimeType)
	if len(fe) == 0 {
		return "", common.ErrUnknownSongFileMimeType
	}

	tn := "temp"
	if err := os.MkdirAll(tn, 0755); err != nil {
		return "", err
	}

	fn := fmt.Sprintf("song-%d.%s", time.Now().Unix(), fe)
	fp := filepath.Join(tn, fn)
	if err := util.WriteFile(song.StreamData.Readable, fp); err != nil {
		return "", err
	}

	return fp, nil
}
