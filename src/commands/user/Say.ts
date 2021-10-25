import { Message } from 'discord.js';

import config from '@/config';
import Bot from '@/structs/Bot';
import Command from '@/structs/Command';

export default class Say extends Command {
  constructor(bot: Bot) {
    super(bot, {
      name: `${config.botPrefix}say`,
      help: 'Repeat what user says',
      requiredRoleLvl: 0
    });
  }

  async run(msg: Message, args: string[]) {
    const concatArgs = args.join(' ');
    const messageCapitalized =
      concatArgs[0].toUpperCase() + concatArgs.slice(1);

    msg.channel.send(messageCapitalized);
  }
}
