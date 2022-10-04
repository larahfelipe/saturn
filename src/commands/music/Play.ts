import { SlashCommandBuilder, type CommandInteraction } from 'discord.js';

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

    try {
      const { tracks } = (await this.bot.musicPlaybackHandler.getTrack(
        requestedTrack
      )) as GetTrackResult;

      tracks.forEach(
        async (track) =>
          await this.bot.musicPlaybackHandler.play({
            requesterId: interaction.user.id,
            track
          })
      );
    } catch (e) {
      console.error(e);
    }
  }
}
