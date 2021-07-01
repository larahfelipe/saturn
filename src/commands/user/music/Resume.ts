import { Message } from 'discord.js';

import config from '../../../config';
import Command from '../../../structs/Command';
import Bot from '../../../structs/Bot';
import { IQueue } from '../../../types';

export default class Resume extends Command {
  constructor(bot: Bot) {
    super(bot, {
      name: `${config.botPrefix}resume`,
      help: 'Resume the current song',
      permissionLvl: 0
    });
  }

  async run(msg: Message, args: string[]) {
    const queueExists: IQueue = this.bot.queues.get(msg.guild!.id);
    if (!queueExists || !queueExists.connection) return msg.reply('There\'s no song playing in your current channel.');

    await msg.react('👌');
    queueExists.connection.dispatcher.resume();
  }
}
