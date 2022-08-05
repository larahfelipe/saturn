import type { Message } from 'discord.js';

import { MusicPlaybackHandler } from '@/handlers/MusicPlaybackHandler';
import type { Bot } from '@/structures/Bot';
import { Command } from '@/structures/Command';
import type { GetTrackResult } from '@/types';

export class Play extends Command {
  MusicPlaybackHandler!: MusicPlaybackHandler;

  constructor(bot: Bot) {
    super(bot, {
      name: 'Play',
      trigger: ['play', 'p'],
      help: 'Play a track or a Spotify playlist',
      isActive: true
    });
  }

  async execute(msg: Message, args: string[]) {
    if (!args.length)
      return msg.reply('Please provide a track or a Spotify playlist URL.');

    this.MusicPlaybackHandler = MusicPlaybackHandler.getInstance(this.bot, msg);
    const requestedTrack = args.join(' ');

    try {
      const { tracks } = (await this.MusicPlaybackHandler.getTrack(
        requestedTrack
      )) as GetTrackResult;

      tracks.forEach(
        async (track) =>
          await this.MusicPlaybackHandler.play(track, msg.author.id)
      );
    } catch (e) {
      console.error(e);
    }
  }
}
