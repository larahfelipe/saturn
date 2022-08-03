import { config } from 'dotenv';

config();

export default {
  botPrefix: process.env.BOT_PREFIX as string,
  botToken: process.env.BOT_TOKEN as string,
  dbAccessUrl: process.env.DATABASE_URL as string
} as const;
