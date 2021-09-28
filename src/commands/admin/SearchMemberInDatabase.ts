import { Message } from 'discord.js';

import config from '@/config';
import Command from '@/structs/Command';
import Bot from '@/structs/Bot';
import { handleSearchGuildMember } from '@/services/FetchGuildMemberService';

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

    await handleSearchGuildMember(targetMember)
      .then((member) => {
        msg.channel.send(
          `\`· Member: ${member!.username} ─ Role Lvl: ${member!.userRoleLvl}\``
        );
      })
      .catch((err) => {
        console.error(err);
        msg.reply(`${targetMember.user.username} was not found in database.`);
      });
  }
}
