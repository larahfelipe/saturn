import { SlashCommandBuilder, type CommandInteraction } from 'discord.js';

import { MusicPlaybackHandler } from '@/handlers/MusicPlaybackHandler';
import type { Bot } from '@/structures/Bot';
import { Command } from '@/structures/Command';

export class Stop extends Command {
  constructor(bot: Bot) {
    super(bot, {
      isActive: true,
      build: new SlashCommandBuilder()
        .setName('stop')
        .setDescription('Stops the music playback')
    });
  }

  async execute(interaction: CommandInteraction) {
    if (!this.bot.musicPlaybackHandler)
      this.bot.musicPlaybackHandler = MusicPlaybackHandler.getInstance(
        this.bot,
        interaction
      );

    await this.bot.musicPlaybackHandler.stop(true);
  }
}
