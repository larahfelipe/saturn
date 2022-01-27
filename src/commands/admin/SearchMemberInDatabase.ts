import { Message } from 'discord.js';

import config from '@/config';
import { handleGuildMemberFetchService } from '@/services';
import { Command, Bot } from '@/structs';
import { MemberEssentials } from '@/types';

export default class SearchMemberInDatabase extends Command {
  constructor(bot: Bot) {
    super(bot, {
      name: `${config.botPrefix}find`,
      help: 'Search a member in database',
      requiredRoleLvl: 1
    });
  }

  async run(msg: Message) {
    const targetMember = msg.mentions.members?.first();
    if (!targetMember) return msg.reply('You need to tag someone!');

    try {
      const member = (await handleGuildMemberFetchService(
        targetMember
      )) as MemberEssentials;
      msg.channel.send(
        `\`· Member: ${member.username} ─ Role Lvl: ${member.userRoleLvl}\``
      );
    } catch (err) {
      this.bot.logger.emitErrorReport(err);
      msg.reply(`${targetMember.user.username} was not found in database.`);
    }
  }
}
