import { Message } from 'discord.js';

import config from '../../config';
import Command from '../../structs/Command';
import Bot from '../../structs/Bot';

export default class LeaveServer extends Command {
  constructor(bot: Bot) {
    super(bot, {
      name: `${config.botPrefix}leave`,
      help: 'Leave the server',
      permissionLvl: 2,
    });
  }

  async run(msg: Message, args: string[]) {
    await msg.guild!.leave();
  }
}
