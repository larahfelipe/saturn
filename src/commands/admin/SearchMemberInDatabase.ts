import { Message } from 'discord.js';

import config from '../../config';
import Command from '../../structs/Command';
import Bot from '../../structs/Bot';
import { handleMemberSearch } from '../../services/FetchMemberService';

export default class SearchMemberInDatabase extends Command {
  constructor(bot: Bot) {
    super(bot, {
      name: `${config.botPrefix}find`,
      help: 'Search a member in database',
      permissionLvl: 1,
    });
  }

  async run(msg: Message, args: string[]) {
    const targetMember = msg.mentions.members?.first();
    if (!targetMember) return msg.reply('You need to tag someone!');

    try {
      const member = await handleMemberSearch(targetMember!);
      if (member) {
        msg.channel.send(
          `\`· Member: ${member.username} ─ Role Lvl: ${member.roleLvl}\``,
        );
      }
    } catch (err) {
      console.error(err);
      msg.reply('Member was not found in database.');
    }
  }
}
