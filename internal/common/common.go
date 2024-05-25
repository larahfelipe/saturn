package common

import "fmt"

var (
	ErrMissingDiscordBotToken  = fmt.Errorf("missing bot token")
	ErrMissingDiscordBotPrefix = fmt.Errorf("missing bot prefix")
	ErrUnknownVoiceChannel     = fmt.Errorf("unable to find message's author voice channel")
	ErrMissingYoutubeUrl       = fmt.Errorf("missing youtube song url")
	ErrUnknownSongFileMimeType = fmt.Errorf("unable to determine file extension from mime type")
	ErrInvalidPrintDataType    = fmt.Errorf("input object is not a struct")
)
