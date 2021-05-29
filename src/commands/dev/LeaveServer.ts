import { Message } from 'discord.js';

import config from '../../config';
import { Bot } from '../..';

async function run (bot: Bot, msg: Message, args: string[]) {
  await msg.guild!.leave();
}

export default {
  name: `${config.botPrefix}leave`,
  help: 'Leaves the server',
  permissionLvl: 2,
  run
};
