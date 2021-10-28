import { Message } from 'discord.js';

import config from '@/config';
import MessageHandler from '@/handlers/MessageHandler';
import Bot from '@/structs/Bot';
import Command from '@/structs/Command';

export default class MessagesCleanup extends Command {
  constructor(bot: Bot) {
    super(bot, {
      name: `${config.botPrefix}clear`,
      help: 'Cleans the messages in the channel',
      requiredRoleLvl: 1
    });
  }

  async run(msg: Message) {
    if (msg.channel.type === 'dm') return;

    const fetchMsgs = await MessageHandler.firstHundredSent(msg);
    msg.channel.bulkDelete(fetchMsgs);
  }
}
