import { Message } from 'discord.js';

import Bot from './Bot';
import { ICommandDescription } from '../types';

abstract class Command {
  bot: Bot;
  name: string;
  description: ICommandDescription;

  constructor(bot: Bot, description: ICommandDescription) {
    this.bot = bot;
    this.description = description;
    this.name = description.name;
  }

  abstract run(msg: Message, args: string[]): Promise<any>;
}

export default Command;
