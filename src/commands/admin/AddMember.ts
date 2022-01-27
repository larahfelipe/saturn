import { Message, MessageEmbed } from 'discord.js';

import config from '@/config';
import { MongoDbIconUrl, MongoDbColor } from '@/constants';
import { handleGuildMemberCreationService } from '@/services';
import { Command, Bot } from '@/structs';

export default class AddMember extends Command {
  constructor(bot: Bot) {
    super(bot, {
      name: `${config.botPrefix}add`,
      help: 'Add a new member to database',
      requiredRoleLvl: 1
    });
  }

  async run(msg: Message) {
    const targetMember = msg.mentions.members?.first();
    if (!targetMember) return msg.reply('You need to tag someone.');

    const embed = new MessageEmbed();
    embed
      .setAuthor('Saturn Database Manager', this.bot.user!.avatarURL()!)
      .setDescription(
        `» ${targetMember}'s registry was created by ${msg.author.username}.\nDatabase was updated at ${msg.createdAt}.`
      )
      .setTimestamp(Date.now())
      .setFooter('MongoDB', MongoDbIconUrl)
      .setColor(MongoDbColor);

    try {
      await handleGuildMemberCreationService(targetMember, msg);
      msg.channel.send({ embed });
    } catch (err) {
      console.error(err);
      this.bot.logger.emitErrorReport(err);
      msg.reply(`${targetMember.user.username} is already in the database.`);
    }
  }
}
