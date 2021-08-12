import { Message, MessageEmbed } from 'discord.js';

import config from '../../config';
import Command from '../../structs/Command';
import Bot from '../../structs/Bot';
import { handleFetchAllMembers } from '../../services/FetchMemberService';
import {
  handleMemberElevation,
  handleMemberDemotion,
} from '../../services/UpdateMemberService';
import { handleMemberDeletion } from '../../services/DeleteMemberService';
import { IMemberEssentials } from '../../types';

export default class FetchAllMembersInDatabase extends Command {
  constructor(bot: Bot) {
    super(bot, {
      name: `${config.botPrefix}findall`,
      help: 'List all members in database',
      permissionLvl: 2,
    });
  }

  async run(msg: Message, args: string[]) {
    try {
      let concatMembersData = '';
      const members = await handleFetchAllMembers();
      if (!members) return msg.reply('No member was found in database.');

      members.forEach((member: IMemberEssentials, index: number) => {
        concatMembersData += `**${index}** ─ ${member.roleLvl} • ${member.username}\n`;
      });

      if (args) {
        const targetMemberIndex = parseInt(args[1]);
        const targetOperation = args[2];

        if (args[0] === '&SELECT') {
          const targetMember = members.find((member, index) => {
            if (index === targetMemberIndex) return member;
          });

          switch (targetOperation) {
            case '&SETADMIN':
              handleMemberElevation(<string>targetMember!.userID);
              break;
            case '&UNSETADMIN':
              handleMemberDemotion(<string>targetMember!.userID);
              break;
            case '&DELETE':
              handleMemberDeletion(msg.author, targetMember!.userID);
              break;
            default:
              return msg.channel.send('Unknown command.');
          }
          return msg.channel.send(`Database was updated • ${msg.createdAt}`);
        }
      }

      const embed = new MessageEmbed();
      embed
        .setAuthor(
          'SATURN Database Manager\nReg Index ─ Member Role Lvl • Member Username',
        )
        .setDescription(concatMembersData)
        .setTimestamp(Date.now())
        .setFooter(
          'MongoDB',
          'https://pbs.twimg.com/profile_images/1234528105819189248/b6F1hk_6_400x400.jpg',
        )
        .setColor('#6E76E5');
      msg.channel.send({ embed });
    } catch (err) {
      console.error(err);
      msg.reply("Couldn't retrieve members in database.");
    }
  }
}
