import { Message } from 'discord.js';
import { Bot } from '../..';

async function run (bot: Bot, msg: Message, args: string[]) {
  await msg.guild!.leave();
}

export default {
  name: `${process.env.BOT_PREFIX}leave`,
  help: 'Leaves the server',
  permissionLvl: 2,
  run
};
