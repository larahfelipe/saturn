import { Message, MessageEmbed } from 'discord.js';
import { Bot } from '../../..';

import { Reaction } from '../../../utils/ReactionsHandler';
import { IQueue } from './Play';

function run (bot: Bot, msg: Message, args: string[]) {
  const queueExists: IQueue = bot.queues.get(msg.guild!.id);
  if (!queueExists) return msg.reply('There\'s no song playing in your current channel.');

  const embed = new MessageEmbed();
  embed
    .setTitle('⏹  Stop Music')
    .setDescription('Understood! Stopping the music function.')
    .setColor('#6E76E5');
  msg.channel.send({ embed });

  queueExists.connection.disconnect();
  bot.queues.delete(msg.guild!.id);
  Reaction.handleDeletion(true);
}

export default {
  name: '.stop',
  help: 'Stops the music function',
  permissionLvl: 0,
  run
};
