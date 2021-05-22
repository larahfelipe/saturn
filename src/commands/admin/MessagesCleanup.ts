import { Message } from 'discord.js';

import config from '../../config';
import { Bot } from '../..';
import { FetchMessages } from '../../utils/FetchMessages';

async function run (bot: Bot, msg: Message, args: string[]) {
  if (msg.channel.type === 'dm') return;
  
  let fetchMsgs = await FetchMessages.firstHundredSent(msg);
  msg.channel.bulkDelete(fetchMsgs);
}

export default {
  name: `${config.botPrefix}clear`,
  help: 'Cleans the messages in the current text channel',
  permissionLvl: 1,
  run
};
