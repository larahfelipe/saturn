import { Message, MessageEmbed } from 'discord.js';
import ytdl from 'ytdl-core';

import Bot from '../structs/Bot';
import ReactionHandler from './ReactionHandler';
import { dropBotQueueConnection } from '../utils/DropBotQueueConnection';
import { IQueue } from '../types';

class SongHandler {
  static async setSong(
    bot: Bot,
    msg: Message,
    song: any,
    requestAuthor: string
  ) {
    let queue: IQueue = bot.queues.get(msg.guild!.id);

    if (!song) {
      if (queue) {
        queue.connection.disconnect();
        return bot.queues.delete(msg.guild!.id);
      }
    }

    if (!msg.member?.voice.channel)
      return msg.reply('You need to be in a voice channel to play a song.');

    if (!queue) {
      const botConnection = await msg.member.voice.channel.join();

      queue = {
        connection: botConnection,
        songs: [song],
        authors: [requestAuthor],
        volume: 10,
        dispatcher: null,
      };
    }

    try {
      queue.dispatcher = queue.connection.play(
        ytdl(song.url, {
          filter: 'audioonly',
          quality: 'highestaudio',
        })
      );

      const embed = new MessageEmbed();
      embed
        .setAuthor(
          'We hear you 💜',
          'https://raw.githubusercontent.com/felpshn/saturn-bot/master/src/assets/cd.gif'
        )
        .setThumbnail(song.thumbnail)
        .setDescription(
          `Now playing **[${song.title}](${song.url})** requested by <@${queue.authors[0]}>`
        )
        .setFooter(`Song duration: ${song.timestamp}`)
        .setColor('#6E76E5');

      msg.channel.send({ embed }).then((sentMsg) => {
        ReactionHandler.resolveMusicControls(bot, msg, sentMsg);
      });

      queue.dispatcher.on('finish', () => {
        queue.songs.shift();
        queue.authors.shift();
        ReactionHandler.performDeletion(true);

        SongHandler.setSong(bot, msg, queue.songs[0], queue.authors[0]);
      });

      bot.queues.set(msg.guild!.id, queue);
    } catch (err) {
      dropBotQueueConnection(bot, msg);
      console.error(err);
    }
  }
}

export default SongHandler;
