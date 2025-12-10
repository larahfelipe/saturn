package player

import (
	"fmt"
	"time"

	dg "github.com/bwmarrin/discordgo"
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
