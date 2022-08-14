import { SlashCommandBuilder, type CommandInteraction } from 'discord.js';

import type { Bot } from '@/structures/Bot';
import { Command } from '@/structures/Command';

export class MessageChannelCleanup extends Command {
  constructor(bot: Bot) {
    super(bot, {
      isActive: true,
      build: new SlashCommandBuilder()
        .setName('cleanup')
        .setDescription('Cleans up the message channel')
    });
  }

  async execute(interaction: CommandInteraction) {
    const firstHundredSentMessages =
      await this.bot.messageChannelHandler.getFirstHundredSent();
    if (!firstHundredSentMessages)
      return interaction.followUp('Could not fetch messages');

    await this.bot.messageChannelHandler.bulkDelete(
      firstHundredSentMessages as any
    );
  }
}
