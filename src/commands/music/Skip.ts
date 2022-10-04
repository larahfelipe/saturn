import { SlashCommandBuilder } from 'discord.js';

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

  async execute() {
    await this.bot.musicPlaybackHandler.skip();
  }
}
