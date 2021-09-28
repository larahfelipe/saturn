import { config } from 'dotenv';

config();

export default {
  botPrefix: process.env.BOT_PREFIX,
  botToken: process.env.BOT_TOKEN,
  botDevToken: process.env.BOT_DEVTOKEN,
  dbAccess: process.env.DB_ACCESS,
  openWeatherToken: process.env.OPENWEATHER_TOKEN,
  environment: process.env.NODE_ENV,
  errorLogsChannelId: process.env.ERRORLOGS_CHANNELID,
  mainColor: '#6E76E5',
  errorColor: '#FB3640',
  warningColor: '#FFB319',
  spotifyColor: '#1ED760',
  mongoDbColor: '#3FA037',
  openWeatherColor: '#FB9300',
  cdGifUrl:
    'https://raw.githubusercontent.com/felpshn/saturn-bot/master/src/assets/cd.gif',
  mongoDbIconUrl:
    'https://pbs.twimg.com/profile_images/1234528105819189248/b6F1hk_6_400x400.jpg',
  spotifyIconUrl:
    'https://www.freepnglogos.com/uploads/spotify-logo-png/spotify-download-logo-30.png',
  openWeatherIconUrl:
    'https://openweathermap.org/themes/openweathermap/assets/img/mobile_app/android_icon.png',
  discordIconUrl:
    'https://discord.com/assets/2c21aeda16de354ba5334551a883b481.png'
} as const;
