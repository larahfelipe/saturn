import { SlashCommandBuilder, type CommandInteraction } from 'discord.js';

import { MusicPlaybackHandler } from '@/handlers/MusicPlaybackHandler';
import type { Bot } from '@/structures/Bot';
import { Command } from '@/structures/Command';

export class Skip extends Command {
  constructor(bot: Bot) {
    super(bot, {
      isActive: true,
      build: new SlashCommandBuilder()
        .setName('skip')
        .setDescription('Skips the current track')
    });
  }

  async execute(interaction: CommandInteraction) {
    if (!this.bot.musicPlaybackHandler)
      this.bot.musicPlaybackHandler = MusicPlaybackHandler.getInstance(
        this.bot,
        interaction
      );

    await this.bot.musicPlaybackHandler.skip();
  }
}
