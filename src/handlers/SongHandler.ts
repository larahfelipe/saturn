import { Message, MessageEmbed } from 'discord.js';
import ytdl from 'ytdl-core';

import Song from '../structs/Song';
import Bot from "../structs/Bot";
import { IQueue } from '../types';
import ReactionHandler from './ReactionHandler';
import { dropBotQueueConnection } from '../utils/DropBotQueueConnection';

class SongHandler extends Song {
  constructor(bot: Bot, msg: Message) {
    super(bot, msg);
  }

  async setSong(song: any, requestAuthor: string) {
    let queue: IQueue = this.bot.queues.get(this.msg.guild!.id);

    if (!song) {
      if (queue) {
        queue.connection.disconnect();
        return this.bot.queues.delete(this.msg.guild!.id);
      }
    }

    if (!this.msg.member?.voice.channel) return this.msg.reply('You need to be in a voice channel to play a song.');

    if (!queue) {
      const botConnection = await this.msg.member.voice.channel.join();

      queue = {
        connection: botConnection,
        songs: [song],
        authors: [requestAuthor],
        volume: 10,
        dispatcher: null
      };
    }

    try {
      queue.dispatcher = queue.connection.play(
        ytdl(song.url, {
          filter: 'audioonly',
          quality: 'highestaudio'
        })
      );

      const embed = new MessageEmbed();
      embed
        .setAuthor('We hear you 💜', 'https://raw.githubusercontent.com/felpshn/saturn-bot/master/assets/cd.gif')
        .setThumbnail(song.thumbnail)
        .setDescription(`Now playing **[${song.title}](${song.url})** requested by <@${queue.authors[0]}>`)
        .setFooter(`Song duration: ${song.timestamp}`)
        .setColor('#6E76E5');

      this.msg.channel.send({ embed })
        .then((sentMsg) => {
          ReactionHandler.resolveMusicControls(this.bot, this.msg, sentMsg);
        });

      queue.dispatcher.on('finish', () => {
        queue.songs.shift();
        queue.authors.shift();
        ReactionHandler.performDeletion(true);

        new SongHandler(this.bot, this.msg).setSong(queue.songs[0], queue.authors[0]);
      });

      this.bot.queues.set(this.msg.guild!.id, queue);
    } catch (err) {
      dropBotQueueConnection(this.bot, this.msg);
      console.error(err);
    }
  }
}

export default SongHandler;
