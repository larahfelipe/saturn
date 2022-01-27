import { Message, MessageEmbed } from 'discord.js';

import config from '@/config';
import { AppMainColor } from '@/constants';
import { ReactionHandler, PlaybackHandler } from '@/handlers';
import { Command, Bot } from '@/structs';

export default class Stop extends Command {
  constructor(bot: Bot) {
    super(bot, {
      name: `${config.botPrefix}stop`,
      help: 'Stop the music function',
      requiredRoleLvl: 0
    });
  }

  async run(msg: Message) {
    const queueExists = this.bot.queues.get(msg.guild!.id);
    if (!queueExists)
      return msg.reply("There's no song playing in your current channel.");

    const embed = new MessageEmbed();
    embed
      .setTitle('⏹  Stop Music')
      .setDescription('Understood! Stopping the music function.')
      .setColor(AppMainColor);
    msg.channel.send({ embed });

    queueExists.connection.disconnect();
    this.bot.queues.delete(msg.guild!.id);
    ReactionHandler.deleteAsync(PlaybackHandler.musicControls);
  }
}
