import { app } from '@/server/Server';
import { Bot } from '@/structures/Bot';

import config from './config';
import { APP_SERVER_RUNNING } from './constants';

const bootstrap = async () => {
  try {
    const bot = Bot.getInstance();
    const isConnected = await bot.makeDiscordAPIConnection();
    if (!isConnected)
      throw new Error('Something went wrong while connecting to Discord API');

    app.listen(config.port, () =>
      console.log(`${APP_SERVER_RUNNING} ${config.port}`)
    );
  } catch (e) {
    console.error(e);
  }
};

bootstrap();
