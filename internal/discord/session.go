package discord

import dg "github.com/bwmarrin/discordgo"

type Discord struct {
	Session *dg.Session
}

// New creates a new discord service.
func New(token string) (*Discord, error) {
	s, err := dg.New("Bot " + token)
	if err != nil {
		return nil, err
	}

	return &Discord{Session: s}, nil
}

// Connect creates a websocket connection to Discord.
func (d *Discord) Connect() error {
	if err := d.Session.Open(); err != nil {
		return err
	}

	return nil
}

// Disconnect closes a websocket connection to Discord.
func (d *Discord) Disconnect() error {
	if err := d.Session.Close(); err != nil {
		return err
	}

	return nil
}
