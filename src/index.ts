import { Bot } from '@/structures/Bot';

import config from './config';
import {
  APP_API_CONNECTION_FAILED,
  APP_MISSING_REQUIRED_CREDENTIALS
} from './constants';
import { MissingRequiredCredentialsError } from './errors/MissingRequiredCredentialsError';

const bootstrap = async () => {
  try {
    const { botToken, botAppId, guildId } = config;

    if (!botToken || !botAppId || !guildId)
      throw new MissingRequiredCredentialsError(
        APP_MISSING_REQUIRED_CREDENTIALS
      );

    const bot = Bot.getInstance();

    const isConnected = await bot.makeDiscordAPIConnection(botToken);

    if (!isConnected) throw new Error(APP_API_CONNECTION_FAILED);
  } catch (e) {
    console.error(e);
  }
};

bootstrap();
