import { Message, MessageEmbed } from 'discord.js';
import { Bot } from '../../..';

import { setSong, IQueue } from './Play';

function run (bot: Bot, msg: Message, args: string[]) {
  const queueExists: IQueue = bot.queues.get(msg.guild!.id);
  if (!queueExists) return msg.reply('There\'s no song currently playing.');

  if (queueExists.songs.length > 1) {
    queueExists.songs.shift();
    queueExists.authors.shift();

    const embed = new MessageEmbed();
    embed
      .setTitle('⏭  Skip Music')
      .setDescription('Okay! Setting up the next song for you.')
      .setColor('#6E76E5');
    msg.channel.send({ embed });

    setSong(bot, msg, queueExists.songs[0], queueExists.authors[0]);
  }
}

export default {
  name: '.skip',
  help: 'Skips the current song',
  permissionLvl: 0,
  run
};
