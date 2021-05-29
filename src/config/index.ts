import dotenv from 'dotenv';

dotenv.config();

export default {
  botPrefix: process.env.BOT_PREFIX,
  botToken: process.env.BOT_TOKEN,
  botDevToken: process.env.BOT_DEVTOKEN,
  dbAccess: process.env.DB_ACCESS,
  openWeatherToken: process.env.OPENWEATHER_TOKEN
}
