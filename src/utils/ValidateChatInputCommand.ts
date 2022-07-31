import type { Message } from 'discord.js';

import config from '@/config';

export const isChatInputCommand = (msg: Message) => {
  let isValid = true;

  if (!msg.content.startsWith(config.botPrefix) || msg.author.bot)
    isValid = false;

  return isValid;
};
