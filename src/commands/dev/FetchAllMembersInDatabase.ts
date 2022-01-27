import { Message, MessageEmbed } from 'discord.js';

import config from '@/config';
import { MongoDbIconUrl, MongoDbColor } from '@/constants';
import {
  handleGuildMemberFetchService,
  handleGuildMemberUpdateService,
  handleGuildMemberDeletionService
} from '@/services';
import { Command, Bot } from '@/structs';
import { MemberEssentials } from '@/types';

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
      const members =
        (await handleGuildMemberFetchService()) as MemberEssentials[];
      if (!members) return msg.reply('No member was found in database.');

      members.forEach((member, index) => {
        concatMembersData += `**${index}** ─ ${member.userRoleLvl} • ${member.username}\n`;
      });

      if (args) {
        const [targetMemberIndex, targetOperation] = args.slice(1);

        if (args[0] === '&SELECT') {
          const targetMember = members.find(
            (_, index) => index === +targetMemberIndex
          );
          if (!targetMember)
            throw new Error('Could not find member in database.');

          switch (targetOperation) {
            case '&SETADMIN':
              handleGuildMemberUpdateService(
                targetMember.userId,
                'PROMOTE',
                msg
              );
              break;
            case '&UNSETADMIN':
              handleGuildMemberUpdateService(
                targetMember.userId,
                'DEMOTE',
                msg
              );
              break;
            case '&DELETE':
              handleGuildMemberDeletionService(targetMember.userId, msg);
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
        .setFooter('MongoDB', MongoDbIconUrl)
        .setColor(MongoDbColor);
      msg.channel.send({ embed });
    } catch (err) {
      this.bot.logger.emitErrorReport(err);
      msg.reply('Could not retrieve members from database.');
    }
  }
}
