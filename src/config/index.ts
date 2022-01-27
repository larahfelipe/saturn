import { config } from 'dotenv';

config();

export default {
  botPrefix: process.env.BOT_PREFIX,
  botToken: process.env.BOT_TOKEN,
  botDevToken: process.env.BOT_DEVTOKEN,
  dbAccess: process.env.DB_ACCESS,
  apiBaseUrl: process.env.API_URL,
  openWeatherToken: process.env.OPENWEATHER_TOKEN,
  environment: process.env.NODE_ENV,
  errorLogsChannelId: process.env.ERRORLOGS_CHANNELID
} as const;
