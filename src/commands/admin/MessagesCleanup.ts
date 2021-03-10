import { Message } from 'discord.js';
import { Bot } from '../..';

async function run (bot: Bot, msg: Message, args: string[]) {
  if (msg.channel.type === 'dm') return;
  
  let fetchedMessages = await msg.channel.messages.fetch({ limit: 100 });
  msg.channel.bulkDelete(fetchedMessages);
}

export default {
  name: '.clear',
  help: 'Cleans the messages in the current text channel',
  permissionLvl: 1,
  run
};
