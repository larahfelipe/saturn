import { Message } from 'discord.js';

import config from '@/config';
import { Command, Bot } from '@/structs';

export default class LeaveServer extends Command {
  constructor(bot: Bot) {
    super(bot, {
      name: `${config.botPrefix}leave`,
      help: 'Leave the server',
      requiredRoleLvl: 2
    });
  }

  async run(msg: Message) {
    try {
      await msg.channel.send('Leaving server... Goodbye! 👋');
      await msg.guild!.leave();
    } catch (err) {
      this.bot.logger.emitErrorReport(err);
    }
  }
}
