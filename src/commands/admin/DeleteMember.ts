import { Message, MessageEmbed } from 'discord.js';

import config from '@/config';
import { MongoDbIconUrl, MongoDbColor } from '@/constants';
import { handleGuildMemberDeletionService } from '@/services';
import { Command, Bot } from '@/structs';

export default class DeleteMember extends Command {
  constructor(bot: Bot) {
    super(bot, {
      name: `${config.botPrefix}del`,
      help: 'Delete a member from database',
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
        `» ${targetMember}'s registry was deleted by ${msg.author.username}.\nDatabase was updated at ${msg.createdAt}.`
      )
      .setTimestamp(Date.now())
      .setFooter('MongoDB', MongoDbIconUrl)
      .setColor(MongoDbColor);

    try {
      await handleGuildMemberDeletionService(targetMember, msg);
      msg.channel.send({ embed });
    } catch (err) {
      this.bot.logger.emitErrorReport(err);
      msg.reply(`${targetMember.user.username} was not found in database.`);
    }
  }
}
