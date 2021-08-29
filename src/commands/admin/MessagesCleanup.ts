import { Message } from 'discord.js';

import config from '../../config';
import Command from '../../structs/Command';
import Bot from '../../structs/Bot';
import MessageHandler from '../../handlers/MessageHandler';

export default class MessagesCleanup extends Command {
  constructor(bot: Bot) {
    super(bot, {
      name: `${config.botPrefix}clear`,
      help: 'Cleans the messages in the invoked channel',
      requiredRoleLvl: 1,
    });
  }

  async run(msg: Message, _: string[]) {
    if (msg.channel.type === 'dm') return;

    let fetchMsgs = await MessageHandler.firstHundredSent(msg);
    msg.channel.bulkDelete(fetchMsgs);
  }
}
