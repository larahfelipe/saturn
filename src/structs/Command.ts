import { Message } from 'discord.js';

import { CommandDescription } from '@/types';

import { Bot } from './Bot';

export abstract class Command {
  bot: Bot;
  name: string;
  description: CommandDescription;

  constructor(bot: Bot, description: CommandDescription) {
    this.bot = bot;
    this.description = description;
    this.name = description.name;
  }

  abstract run(msg: Message, args?: string[]): Promise<any>;
}
