package player

import (
	"fmt"
	"path/filepath"
	"time"

	dg "github.com/bwmarrin/discordgo"

	"github.com/larahfelipe/saturn/internal/common"
	"github.com/larahfelipe/saturn/internal/config"
	"github.com/larahfelipe/saturn/internal/util"
)

type Song struct {
	Title       string
	Url         string
	ArtworkUrl  string
	Duration    string
	RequestedBy string
	Position    int
	Stream      *Stream
}

// BuildMessageEmbed builds an embed message for the song.
func (song *Song) BuildMessageEmbed(queued bool) *dg.MessageEmbed {
	if queued {
		return &dg.MessageEmbed{
			Author: &dg.MessageEmbedAuthor{
				Name: "Queued",
			},
			Title:       song.Title,
			URL:         song.Url,
			Description: fmt.Sprintf("Added to the queue by <@%s> at position %d", song.RequestedBy, song.Position),
			Thumbnail: &dg.MessageEmbedThumbnail{
				URL: song.ArtworkUrl,
			},
			Footer: &dg.MessageEmbedFooter{
				Text: fmt.Sprintf("Duration: %s", song.Duration),
			},
			Timestamp: time.Now().Format(time.RFC3339),
			Color:     0xFFB319,
		}
	}

	return &dg.MessageEmbed{
		Author: &dg.MessageEmbedAuthor{
			Name:    "Now playing",
			IconURL: "https://github.com/larahfelipe/saturn/blob/stale-master/src/assets/cd.gif?raw=true",
		},
		Title:       song.Title,
		URL:         song.Url,
		Description: fmt.Sprintf("Requested by <@%s> Enjoy!", song.RequestedBy),
		Thumbnail: &dg.MessageEmbedThumbnail{
			URL: song.ArtworkUrl,
		},
		Footer: &dg.MessageEmbedFooter{
			Text: fmt.Sprintf("Duration: %s", song.Duration),
		},
		Color: 0x1ED760,
	}
}

// Download downloads the song stream to a local directory.
func (song *Song) Download() (string, error) {
	defer song.Stream.Readable.Close()

	fileExt := util.GetFileExtFromMime(song.Stream.MimeType)
	if len(fileExt) == 0 {
		return "", common.ErrUnknownFileExtFromMimeType
	}

	if err := util.MkDir(config.GetAppDownloadsDirName()); err != nil {
		return "", err
	}

	fileName := fmt.Sprintf("%d.%s", time.Now().Unix(), fileExt)
	filePath := filepath.Join(config.GetAppDownloadsDirName(), fileName)
	if err := util.WriteFile(song.Stream.Readable, filePath); err != nil {
		return "", err
	}

	return filePath, nil
}
