import { Message } from 'discord.js';

import { ICommandDescription } from '@/types';

import Bot from './Bot';

export default abstract class Command {
  bot: Bot;
  name: string;
  description: ICommandDescription;

  constructor(bot: Bot, description: ICommandDescription) {
    this.bot = bot;
    this.description = description;
    this.name = description.name;
  }

  abstract run(msg: Message, args?: string[]): Promise<any>;
}
