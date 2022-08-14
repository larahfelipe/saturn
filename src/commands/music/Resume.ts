import { SlashCommandBuilder, type CommandInteraction } from 'discord.js';

import type { Bot } from '@/structures/Bot';
import { Command } from '@/structures/Command';

export class Resume extends Command {
  constructor(bot: Bot) {
    super(bot, {
      isActive: true,
      build: new SlashCommandBuilder()
        .setName('resume')
        .setDescription('Resumes the current track')
    });
  }

  async execute(interaction: CommandInteraction) {
    this.bot.musicPlaybackHandler.resume();
    await this.bot.messageChannelHandler.signCommandExecution(interaction);
  }
}
