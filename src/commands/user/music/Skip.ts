import { Message, MessageEmbed } from 'discord.js';

import config from '../../../config';
import Command from '../../../structs/Command';
import Bot from '../../../structs/Bot';
import ReactionHandler from '../../../handlers/ReactionHandler';
import SongHandler from '../../../handlers/SongHandler';
import { IQueue } from '../../../types';

export default class Skip extends Command {
  constructor(bot: Bot) {
    super(bot, {
      name: `${config.botPrefix}skip`,
      help: 'Skip the current song',
      permissionLvl: 0
    });
  }

  async run(msg: Message, args: string[]) {
    const queueExists: IQueue = this.bot.queues.get(msg.guild!.id);
    if (!queueExists) return msg.reply('There\'s no song currently playing.');

    if (queueExists.songs.length > 1) {
      queueExists.songs.shift();
      queueExists.authors.shift();
      ReactionHandler.performDeletion(true);

      const embed = new MessageEmbed();
      embed
        .setTitle('⏭  Skip Music')
        .setDescription('Okay! Setting up the next song for you.')
        .setColor('#6E76E5');
      msg.channel.send({ embed });

      new SongHandler(this.bot, msg).setSong(queueExists.songs[0], queueExists.authors[0]);
    }
  }
}
