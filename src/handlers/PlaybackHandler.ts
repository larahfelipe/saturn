import { Message, MessageEmbed } from 'discord.js';
import ytdl from 'ytdl-core';

import { Control, CdGifUrl, AppMainColor } from '@/constants';
import { ReactionHandler } from '@/handlers';
import { Bot } from '@/structs';
import { Song } from '@/types';

export class PlaybackHandler {
  private static INSTANCE: PlaybackHandler;
  protected bot: Bot;
  protected msg: Message;

  static readonly musicControls: string[] = [
    Control.PAUSE,
    Control.PLAY,
    Control.SKIP,
    Control.STOP
  ];

  private constructor(bot: Bot, msg: Message) {
    this.bot = bot;
    this.msg = msg;
  }

  static getInstance(bot: Bot, msg: Message) {
    if (
      !PlaybackHandler.INSTANCE ||
      PlaybackHandler.INSTANCE.msg.guild!.id !== msg.guild!.id ||
      PlaybackHandler.INSTANCE.msg.author.id !== msg.author.id
    )
      PlaybackHandler.INSTANCE = new PlaybackHandler(bot, msg);
    return PlaybackHandler.INSTANCE;
  }

  async setSong(song: Song, requestAuthor: string) {
    let queue = this.bot.queues.get(this.msg.guild!.id);

    if (!song && queue) {
      queue.connection.disconnect();
      return this.bot.queues.delete(this.msg.guild!.id);
    }

    if (!this.msg.member?.voice.channel)
      return this.msg.reply(
        'You need to be in a voice channel to play a song.'
      );

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
        ytdl(song.videoUrl, {
          filter: 'audioonly',
          quality: 'highestaudio'
        })
      );

      const embed = new MessageEmbed();
      embed
        .setAuthor('We hear you 💜', CdGifUrl)
        .setThumbnail(song.altThumbnailUrl)
        .setDescription(
          `Now playing **[${song.title}](${song.videoUrl})** requested by <@${queue.authors[0]}>`
        )
        .setFooter(`Song duration: ${song.durationTimestamp}`)
        .setColor(song.coverColors?.LightVibrant || AppMainColor);

      this.msg.channel.send({ embed }).then((sentMsg) => {
        ReactionHandler.resolvePlaybackControls(sentMsg, this.bot, this.msg);
      });

      queue.dispatcher.on('finish', () => {
        queue!.songs.shift();
        queue!.authors.shift();
        ReactionHandler.deleteAsync(PlaybackHandler.musicControls);

        const playbackHandler = PlaybackHandler.getInstance(this.bot, this.msg);
        playbackHandler.setSong(queue!.songs[0] as Song, queue!.authors[0]);
      });

      this.bot.queues.set(this.msg.guild!.id, queue);
    } catch (err) {
      this.bot.logger.emitErrorReport(err);
    }
  }
}
