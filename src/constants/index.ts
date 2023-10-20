export const APP_NAME = 'Saturn';
export const APP_ACTIVITY = 'Orbiting in the space';
export const APP_COMMANDS_LOADED = `\n[${APP_NAME}] Commands loaded successfully.`;
export const APP_READY = `\n[${APP_NAME}] Discord API ready to listen interactions.`;
export const APP_FOUND_DATABASE_ACCESS_URL = `\n[${APP_NAME}] Found database access URL. Trying to establish connection...`;
export const APP_DATABASE_CONNECTED = `\n[${APP_NAME}] Database connection successfully established.`;

export const APP_MISSING_REQUIRED_CREDENTIALS =
  '\nMissing required credentials.';
export const APP_COMMAND_ERROR_TITLE = '❌ Whoops, a wild error appeared! 😱';
export const APP_COMMAND_ERROR_DESCRIPTION =
  "Rest assured, it's not your fault in the slightest!\n\n🌟 My best guess is that there might be a tiny typo in your command or a little glitch in the execution process, in that case, please try again later.\n";
export const APP_RUNTIME_EXCEPTION = 'RUNTIME EXCEPTION';
export const APP_API_CONNECTION_FAILED =
  "Something went wrong while trying to connect to Discord's API. Please review your credentials and try again later.";
export const APP_USER_NOT_IN_VOICE_CHANNEL =
  'You need to be in a voice channel first.';

export const APP_MUSIC_PLAYBACK_PHRASE = 'I got you 💜';
export const APP_MUSIC_PLAYBACK_TITLE = '🎵  Music Playback';
export const APP_LOADING_PLAYLIST_TRACKS_TITLE =
  'Gotcha!, loading playlist songs ... ⏳';
export const APP_LOADING_PLAYLIST_TRACKS_DESCRIPTION =
  "I'll join the party in a moment, please wait";
export const APP_NO_TRACK_PLAYING = "There's no track playing right now.";
export const APP_QUEUE_TITLE = '📃  Queue';
export const APP_QUEUE_EMPTY = 'The queue is empty.';
export const APP_SKIP_TRACK_TITLE = '⏭  Skip Music';
export const APP_SKIP_TRACK_DESCRIPTION =
  'Okay! Setting up the next song for you.';
export const APP_STOP_MUSIC_PLAYBACK_TITLE = '⏹  Stop Music';
export const APP_STOP_MUSIC_PLAYBACK_DESCRIPTION =
  'Understood! Stopping the music playback.';
export const SPOTIFY_PHRASE = 'Spotify | Music for everyone';

export const APP_MAIN_COLOR = '#6E76E5';
export const APP_SUCCESS_COLOR = '#00FF00';
export const APP_ERROR_COLOR = '#FB3640';
export const APP_WARNING_COLOR = '#FFB319';

export const PLATFORMS = {
  Spotify: {
    name: 'Spotify',
    color: '#1ED760',
    baseUrl: 'https://open.spotify.com/'
  },
  YouTube: {
    name: 'YouTube',
    color: '#FF0000',
    baseUrl: 'https://www.youtube.com/'
  }
} as const;

export const MAX_VOICE_CONNECTION_JOIN_ATTEMPTS = 5;

export const CD_GIF_URL =
  'https://raw.githubusercontent.com/larahfelipe/saturn/master/src/assets/cd.gif';

export const PROJECT_AUTHOR_URL = 'https://github.com/larahfelipe/';
export const PROJECT_REPOSITORY_URL = 'https://github.com/larahfelipe/saturn/';

export const THUMBS_UP_EMOJI = '👍';
export const OKAY_EMOJI = '👌';
export const SATURN_EMOJI = '🪐';
