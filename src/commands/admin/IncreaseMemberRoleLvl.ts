import { Message, MessageEmbed } from 'discord.js';

import config from '../../config';
import Command from '../../structs/Command';
import Bot from '../../structs/Bot';
import { handleMemberElevation } from '../../services/UpdateMemberService';

export default class IncreaseMemberRoleLvl extends Command {
  constructor(bot: Bot) {
    super(bot, {
      name: `${config.botPrefix}setadmin`,
      help: 'Set a member as server administrator',
      permissionLvl: 1
    });
  }

  async run(msg: Message, args: string[]) {
    const targetMember = msg.mentions.members?.first();
    if (!targetMember) return msg.reply('You need to tag someone!');
  
    const embed = new MessageEmbed();
    embed
      .setAuthor(`SATURN Database Manager`, this.bot.user?.avatarURL()!)
      .setDescription(`**» ${targetMember} REGISTRY HAS BEEN UPDATED.**\n*Database was updated at ${msg.createdAt}.*`)
      .setTimestamp(Date.now())
      .setFooter('MongoDB', 'https://pbs.twimg.com/profile_images/1234528105819189248/b6F1hk_6_400x400.jpg')
      .setColor('#6E76E5');

    await handleMemberElevation(targetMember)
      .then(() => msg.channel.send({ embed }))
      .catch(err => {
        console.error(err);
        msg.reply('Member was not found in database.');
      });
  }
}
