import { Message } from 'discord.js';

import type { CommandDetails } from '@/types';

import type { Bot } from './Bot';

export abstract class Command {
  bot: Bot;
  details: CommandDetails;
  name: string;
  trigger: [string, string?];

  constructor(bot: Bot, details: CommandDetails) {
    this.bot = bot;
    this.details = details;
    this.name = details.name;
    this.trigger = details.trigger;
  }

  abstract execute(msg: Message, args?: string[]): Promise<unknown>;
}
