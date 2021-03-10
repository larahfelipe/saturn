import { Message, MessageEmbed } from 'discord.js';
import { Bot } from '../../..';

import { IQueue } from './Play';

function run (bot: Bot, msg: Message, args: string[]) {
  const queueExists: IQueue = bot.queues.get(msg.guild!.id);
  let concatQueueStr = '';

  if (queueExists.songs.length === 1) {
    concatQueueStr = 'Hmm.. Seems like the queue is empty 🤔\nTry add a song!';
  } else {
    queueExists.songs.forEach(song => {
      if (queueExists.songs.indexOf(song) === 0) return;
      concatQueueStr += `**${queueExists.songs.indexOf(song)}** — ${song.title} \`[${song.timestamp}]\`\n`;
    });
  }

  const embed = new MessageEmbed();
  embed
    .setTitle('📃  Music Queue')
    .addField('Currently Listening', `${queueExists.songs[0].title}`, true)
    .addField('Duration', `${queueExists.songs[0].timestamp}`, true)
    .addField('Coming Next', concatQueueStr)
    .setColor('#6E76E5');
  msg.channel.send({ embed });
}

export default {
  name: '.queue',
  help: 'Shows the server\'s music queue',
  permissionLvl: 0,
  run
};
