import { Message, MessageEmbed } from 'discord.js';

import config from '@/config';
import { MongoDbIconUrl, MongoDbColor } from '@/constants';
import { handleGuildMemberUpdateService } from '@/services';
import { Command, Bot } from '@/structs';

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
      .setAuthor('Saturn Database Manager', this.bot.user!.avatarURL()!)
      .setDescription(
        `» ${targetMember}'s registry was updated by ${msg.author.username}.\nDatabase was updated at ${msg.createdAt}.`
      )
      .setTimestamp(Date.now())
      .setFooter('MongoDB', MongoDbIconUrl)
      .setColor(MongoDbColor);

    try {
      await handleGuildMemberUpdateService(targetMember, 'PROMOTE', msg);
      msg.channel.send({ embed });
    } catch (err) {
      this.bot.logger.emitErrorReport(err);
      msg.reply(`${targetMember.user.username} was not found in database.`);
    }
  }
}
