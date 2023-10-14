import { SlashCommandBuilder, type CommandInteraction } from 'discord.js';

import { MusicPlaybackHandler } from '@/handlers/MusicPlaybackHandler';
import type { Bot } from '@/structures/Bot';
import { Command } from '@/structures/Command';
import type { GetTrackResult } from '@/types';

export class Play extends Command {
  constructor(bot: Bot) {
    super(bot, {
      isActive: true,
      build: new SlashCommandBuilder()
        .setName('play')
        .setDescription('Plays a track from YouTube or Spotify')
        .addStringOption((option) =>
          option
            .setName('track')
            .setDescription('The track name or URL to play')
            .setRequired(true)
        )
    });
  }

  async execute(interaction: CommandInteraction) {
    if (!this.bot.musicPlaybackHandler)
      this.bot.musicPlaybackHandler = MusicPlaybackHandler.getInstance(
        this.bot,
        interaction
      );

    const requestedTrack = interaction.options.get('track')!.value as string;

    const { tracks } = (await this.bot.musicPlaybackHandler.getTrack(
      requestedTrack
    )) as GetTrackResult;

    await Promise.all(
      tracks.map(
        async (track) =>
          await this.bot.musicPlaybackHandler.play({
            requesterId: interaction.user.id,
            track
          })
      )
    );
  }
}
