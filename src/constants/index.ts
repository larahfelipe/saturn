import config from '@/config';

export const AppRequiredCredentialsError = 'Prefix and/or Token not settled.';
export const AppRequiredCredentalsTypeError = 'Tokens must be of type string.';
export const AppCommandErrorTitle = '❌ Whoops, a wild error appeared!';
export const AppCommandErrorDescription = `Why I'm seeing this?! 🤔\n\nYou probably have a typo in your command's message or you currently don't have permission to execute this command.\n\nYou can get a full commands list by typing \`${config.botPrefix}help\``;

export const AppMainColor = '#6E76E5';
export const AppErrorColor = '#FB3640';
export const AppWarningColor = '#FFB319';
export const SpotifyColor = '#1ED760';
export const MongoDbColor = '#3FA037';
export const OpenWeatherColor = '#FB9300';

export const YouTubeBaseUrl = 'https://www.youtube.com/';
export const SpotifyBaseUrl = 'https://open.spotify.com/';

export const CdGifUrl =
  'https://raw.githubusercontent.com/larafe1/saturn-bot/master/src/assets/cd.gif';
export const MongoDbIconUrl =
  'https://pbs.twimg.com/profile_images/1234528105819189248/b6F1hk_6_400x400.jpg';
export const SpotifyIconUrl =
  'https://www.freepnglogos.com/uploads/spotify-logo-png/spotify-download-logo-30.png';
export const OpenWeatherIconUrl =
  'https://openweathermap.org/themes/openweathermap/assets/img/mobile_app/android_icon.png';
export const DiscordIconUrl =
  'https://discord.com/assets/2c21aeda16de354ba5334551a883b481.png';

export const ProjectAuthorUrl = 'https://github.com/larafe1/';
export const ProjectUrl = 'https://github.com/larafe1/saturn-bot/';

export enum Control {
  PLAY = '▶️',
  PAUSE = '⏸',
  STOP = '⏹️',
  SKIP = '⏭️'
}

export const DefaultSpotifyPlaylistObj = {
  name: '',
  owner: '',
  cover: '',
  duration: 0,
  tracks: []
};
