import { config } from 'dotenv';

config();

export default {
  botPrefix: process.env.BOT_PREFIX as string,
  botToken: process.env.BOT_TOKEN as string
} as const;
