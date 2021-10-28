import { Message, MessageEmbed } from 'discord.js';

import config from '@/config';
import { handleGuildMemberDeletion } from '@/services/DeleteGuildMemberService';
import { handleFetchAllMembersInDatabase } from '@/services/FetchGuildMemberService';
import {
  handleGuildMemberElevation,
  handleGuildMemberDemotion
} from '@/services/UpdateGuildMemberService';
import Bot from '@/structs/Bot';
import Command from '@/structs/Command';

export default class FetchAllMembersInDatabase extends Command {
  constructor(bot: Bot) {
    super(bot, {
      name: `${config.botPrefix}findall`,
      help: 'List all members in database',
      requiredRoleLvl: 2
    });
  }

  async run(msg: Message, args: string[]) {
    try {
      let concatMembersData = '';
      const members = await handleFetchAllMembersInDatabase();
      if (!members) return msg.reply('No member was found in database.');

      members.forEach((member, index) => {
        concatMembersData += `**${index}** ─ ${member.userRoleLvl} • ${member.username}\n`;
      });

      if (args) {
        const targetMemberIndex = parseInt(args[1]);
        const targetOperation = args[2];

        if (args[0] === '&SELECT') {
          const targetMember = members.find(
            (_, index) => index === targetMemberIndex
          );

          switch (targetOperation) {
            case '&SETADMIN':
              handleGuildMemberElevation(targetMember!.userId as string, msg);
              break;
            case '&UNSETADMIN':
              handleGuildMemberDemotion(targetMember!.userId as string, msg);
              break;
            case '&DELETE':
              handleGuildMemberDeletion(targetMember!.userId as string, msg);
              break;
            default:
              return msg.channel.send('Unknown command.');
          }
          return msg.channel.send(
            `${targetMember!.username}'s registry was updated by ${
              msg.author.username
            }.\nDatabase was updated at ${msg.createdAt}`
          );
        }
      }

      const embed = new MessageEmbed();
      embed
        .setAuthor(
          'Saturn Database Manager\nReg Index ─ Member Role Lvl • Member Username'
        )
        .setDescription(concatMembersData)
        .setTimestamp(Date.now())
        .setFooter('MongoDB', config.mongoDbIconUrl)
        .setColor(config.mongoDbColor);
      msg.channel.send({ embed });
    } catch (err) {
      console.error(err);
      msg.reply("Couldn't retrieve members from database.");
    }
  }
}
