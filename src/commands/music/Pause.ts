import { SlashCommandBuilder, type CommandInteraction } from 'discord.js';

import type { Bot } from '@/structures/Bot';
import { Command } from '@/structures/Command';

export class Pause extends Command {
  constructor(bot: Bot) {
    super(bot, {
      isActive: true,
      build: new SlashCommandBuilder()
        .setName('pause')
        .setDescription('Pauses the current track')
    });
  }

  async execute(interaction: CommandInteraction) {
    this.bot.musicPlaybackHandler.pause();
    await this.bot.messageChannelHandler.signCommandExecution(interaction);
  }
}
