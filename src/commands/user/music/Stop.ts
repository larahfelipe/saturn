import { Message, MessageEmbed } from 'discord.js';

import config from '../../../config';
import Command from '../../../structs/Command';
import Bot from '../../../structs/Bot';
import ReactionHandler from '../../../handlers/ReactionHandler';
import { IQueue } from '../../../types';

export default class Stop extends Command {
  constructor(bot: Bot) {
    super(bot, {
      name: `${config.botPrefix}stop`,
      help: 'Stop the music function',
      permissionLvl: 0
    });
  }

  async run(msg: Message, args: string[]) {
    const queueExists: IQueue = this.bot.queues.get(msg.guild!.id);
    if (!queueExists) return msg.reply('There\'s no song playing in your current channel.');

    const embed = new MessageEmbed();
    embed
      .setTitle('⏹  Stop Music')
      .setDescription('Understood! Stopping the music function.')
      .setColor('#6E76E5');
    msg.channel.send({ embed });

    queueExists.connection.disconnect();
    this.bot.queues.delete(msg.guild!.id);
    ReactionHandler.performDeletion(true);
  }
}
