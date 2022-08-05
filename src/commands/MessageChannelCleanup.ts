import type { Message } from 'discord.js';

import { MessageChannelHandler } from '@/handlers/MessageChannelHandler';
import type { Bot } from '@/structures/Bot';
import { Command } from '@/structures/Command';

export class MessageChannelCleanup extends Command {
  constructor(bot: Bot) {
    super(bot, {
      name: 'MessageChannelCleanup',
      trigger: ['clear'],
      help: 'Clear messages from the current channel',
      isActive: true
    });
  }

  async execute(msg: Message) {
    if (msg.channel.type === 'dm') return;

    const fetchMsgs = await MessageChannelHandler.getInstance(
      msg
    ).getFirstHundredSent();

    await MessageChannelHandler.getInstance(msg).bulkDelete(fetchMsgs);
  }
}
