import { Message } from 'discord.js';

import config from '@/config';
import Bot from '@/structs/Bot';
import Command from '@/structs/Command';

export default class LeaveServer extends Command {
  constructor(bot: Bot) {
    super(bot, {
      name: `${config.botPrefix}leave`,
      help: 'Leave the server',
      requiredRoleLvl: 2
    });
  }

  async run(msg: Message) {
    await msg.guild!.leave();
  }
}
