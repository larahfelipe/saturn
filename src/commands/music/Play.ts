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
    const requestedTrack = interaction.options.get('track')!.value as string;

    const musicPlaybackHandler = MusicPlaybackHandler.getInstance(
      this.bot,
      interaction
    );

    try {
      const { tracks } = (await musicPlaybackHandler.getTrack(
        requestedTrack
      )) as GetTrackResult;

      tracks.forEach(
        async (track) =>
          await musicPlaybackHandler.play(track, interaction.user.id)
      );
    } catch (e) {
      console.error(e);
    }
  }
}
