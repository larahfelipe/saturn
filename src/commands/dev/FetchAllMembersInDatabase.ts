import { Message, MessageEmbed } from "discord.js"
import { Bot } from "../.."

import { IMemberSimplified, handleFetchAllMembers } from '../../services/FetchMemberService';

async function run (bot: Bot, msg: Message, args: string[]) {
  try {
    let concatMembersData = '**Role Lvl ─ Member**\n';

    const members: IMemberSimplified[] = await handleFetchAllMembers();
    members.forEach(elmt => {
      concatMembersData += `   ${elmt.roleLvl} ─ ${elmt.username}\n`;
    });

    const embed = new MessageEmbed();
    embed
      .setDescription(concatMembersData)
      .setColor('#6E76E5');
    msg.channel.send({ embed });
  } catch (err) {
    console.error(err);
    msg.reply('Cannot retrieve members in database!');
  }
}

export default {
  name: '.findall',
  help: 'List all members in database',
  permissionLvl: 2,
  run
};
