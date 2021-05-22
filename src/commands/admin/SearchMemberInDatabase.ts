import { Message } from 'discord.js';

import config from '../../config';
import { Bot } from '../..';
import { IMemberEssentials } from '../../types';
import { handleMemberSearch } from '../../services/FetchMemberService';

async function run (bot: Bot, msg: Message, args: string[]) {
  const targetMember = msg.mentions.members?.first();
  if (!targetMember) return msg.reply('You need to tag someone!');

  try {
    const member: IMemberEssentials = await handleMemberSearch(targetMember!);
    msg.channel.send(`\`· Member: ${member.username} ─ Role Lvl: ${member.roleLvl}\``);
  } catch (err) {
    console.error(err);
    msg.reply('Member is not registered in database!');
  }
}

export default {
  name: `${config.botPrefix}find`,
  help: 'Searches a member in database',
  permissionLvl: 1,
  run
};
