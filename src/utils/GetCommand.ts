import type { Message } from 'discord.js';

import config from '@/config';

const getCommandArguments = (msg: Message) => {
  const args = msg.content.slice(config.botPrefix.length).trim().split(/ +/);

  return args;
};

export const getCommand = (msg: Message) => {
  const args = getCommandArguments(msg);

  const trigger = config.botPrefix + args.shift()?.toLowerCase();

  const formatted = `[@${msg.author.tag}] ${trigger} ${args.join(' ')}`;

  return {
    args,
    trigger,
    formatted
  };
};
