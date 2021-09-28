import { Message, MessageEmbed } from 'discord.js';

import config from '@/config';
import Command from '@/structs/Command';
import Bot from '@/structs/Bot';
import { handleGuildMemberElevation } from '@/services/UpdateGuildMemberService';

export default class IncreaseMemberRoleLvl extends Command {
  constructor(bot: Bot) {
    super(bot, {
      name: `${config.botPrefix}setadmin`,
      help: 'Set a member as server administrator',
      requiredRoleLvl: 1
    });
  }

  async run(msg: Message) {
    const targetMember = msg.mentions.members?.first();
    if (!targetMember) return msg.reply('You need to tag someone!');

    const embed = new MessageEmbed();
    embed
      .setAuthor(`Saturn Database Manager`, this.bot.user!.avatarURL()!)
      .setDescription(
        `» ${targetMember}'s registry was updated by ${msg.author.username}.\nDatabase was updated at ${msg.createdAt}.`
      )
      .setTimestamp(Date.now())
      .setFooter('MongoDB', config.mongoDbIconUrl)
      .setColor(config.mongoDbColor);

    await handleGuildMemberElevation(targetMember, msg)
      .then(() => msg.channel.send({ embed }))
      .catch((err) => {
        console.error(err);
        msg.reply(`${targetMember.user.username} was not found in database.`);
      });
  }
}
