package common

import "fmt"

var (
	ErrMissingDiscordBotToken      = fmt.Errorf("missing bot token")
	ErrMissingDiscordBotPrefix     = fmt.Errorf("missing bot command prefix")
	ErrMissingYoutubeVideoUrl      = fmt.Errorf("missing youtube video url")
	ErrUnknownOrUnavailableCommand = fmt.Errorf("triggered an unknown or unavailable command")
	ErrUnknownVoiceChannel         = fmt.Errorf("could not find the message's author voice channel")
	ErrUnknownFileExtFromMimeType  = fmt.Errorf("could not determine file extension from mime type")
	ErrInvalidPrintDataType        = fmt.Errorf("input object is not a struct")
)
