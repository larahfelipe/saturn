import { SlashCommandBuilder, type CommandInteraction } from 'discord.js';

import { MusicPlaybackHandler } from '@/handlers/MusicPlaybackHandler';
import type { Bot } from '@/structures/Bot';
import { Command } from '@/structures/Command';

export class Resume extends Command {
  constructor(bot: Bot) {
    super(bot, {
      isActive: false,
      build: new SlashCommandBuilder()
        .setName('resume')
        .setDescription('Resume the current song')
    });
  }

  async execute(interaction: CommandInteraction) {
    const musicPlaybackHandler = MusicPlaybackHandler.getInstance(
      this.bot,
      interaction
    );

    await musicPlaybackHandler.resume();
  }
}
