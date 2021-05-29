import { Message } from 'discord.js';

import config from '../../config';
import { Bot } from '../..';

function run (bot: Bot, msg: Message, args: string[]) {
  const concatArgs = args.join(' ');
  const messageCapitalized = concatArgs[0].toUpperCase() + concatArgs.slice(1);

  msg.channel.send(messageCapitalized);
}

export default {
  name: `${config.botPrefix}say`,
  help: 'Repeats what user says',
  permissionLvl: 0,
  run
};
