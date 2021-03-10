import { Message } from 'discord.js';
import { Bot } from '../..';

function run (bot: Bot, msg: Message, args: string[]) {
  const concatArgs = args.join(' ');
  const messageCapitalized = concatArgs[0].toUpperCase() + concatArgs.slice(1);

  msg.channel.send(messageCapitalized);
}

export default {
  name: '.say',
  help: 'Repeats what user says',
  permissionLvl: 0,
  run
};
