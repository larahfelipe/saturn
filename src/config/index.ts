import { config } from 'dotenv';

config();

export default {
  port: process.env.PORT || 8080,
  botToken: process.env.BOT_TOKEN as string,
  botAppId: process.env.BOT_APP_ID as string,
  guildId: process.env.GUILD_ID as string,
  dbAccessUrl: process.env.DATABASE_URL as string
} as const;
