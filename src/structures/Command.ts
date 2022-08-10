import type { CommandInteraction } from 'discord.js';

import type { CommandData } from '@/types';

import type { Bot } from './Bot';

export abstract class Command {
  bot: Bot;
  data: CommandData;

  constructor(bot: Bot, data: CommandData) {
    this.bot = bot;
    this.data = data;
  }

  abstract execute(interaction: CommandInteraction): Promise<unknown>;
}
