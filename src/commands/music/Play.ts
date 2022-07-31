import type { Message } from 'discord.js';

import config from '@/config';
import type { Bot } from '@/structures/Bot';
import { Command } from '@/structures/Command';

export class Play extends Command {
  constructor(bot: Bot) {
    super(bot, {
      name: 'Play',
      trigger: `${config.botPrefix}play`,
      help: 'Play a track',
      usage: 'play <track>'
    });
  }

  async execute(msg: Message) {
    msg.reply('Playing');
  }
}
