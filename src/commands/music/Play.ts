import { SlashCommandBuilder, type CommandInteraction } from 'discord.js';

import { MusicPlaybackHandler } from '@/handlers/MusicPlaybackHandler';
import type { Bot } from '@/structures/Bot';
import { Command } from '@/structures/Command';
import type { GetTrackResult } from '@/types';

export class Play extends Command {
  MusicPlaybackHandler!: MusicPlaybackHandler;

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
    const requestedTrack = interaction.options.get('track')?.value as string;
    if (!requestedTrack?.length)
      return interaction.followUp('Please provide a track to play it.');

    this.MusicPlaybackHandler = MusicPlaybackHandler.getInstance(
      this.bot,
      interaction
    );

    try {
      const { tracks } = (await this.MusicPlaybackHandler.getTrack(
        requestedTrack
      )) as GetTrackResult;

      tracks.forEach(
        async (track) =>
          await this.MusicPlaybackHandler.play(track, interaction.user.id)
      );
    } catch (e) {
      console.error(e);
    }
  }
}
