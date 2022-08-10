import {
  SlashCommandBuilder,
  type CommandInteraction,
  type Interaction
} from 'discord.js';

import { MessageChannelHandler } from '@/handlers/MessageChannelHandler';
import type { Bot } from '@/structures/Bot';
import { Command } from '@/structures/Command';

export class MessageChannelCleanup extends Command {
  constructor(bot: Bot) {
    super(bot, {
      isActive: true,
      build: new SlashCommandBuilder()
        .setName('cleanup')
        .setDescription('Clear the messages in the current channel')
    });
  }

  async execute(interaction: CommandInteraction) {
    const firstHundredSentMessages = await MessageChannelHandler.getInstance(
      interaction as Interaction
    ).getFirstHundredSent();
    if (!firstHundredSentMessages)
      return interaction.followUp('Could not fetch messages');

    await MessageChannelHandler.getInstance(
      interaction as Interaction
    ).bulkDelete(firstHundredSentMessages as any);
  }
}
