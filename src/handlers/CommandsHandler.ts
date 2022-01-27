import { readdirSync } from 'fs';
import { join } from 'path';

import type { Bot } from '@/structures/Bot';
import type { Command } from '@/structures/Command';

type ResolvedCommandObj = {
  [key: string]: Command;
};

export class CommandsHandler {
  protected bot: Bot;
  private modulesLength: number[];
  private allCommands: string[];

  constructor(bot: Bot) {
    this.bot = bot;
    this.modulesLength = [];
    this.allCommands = [];
  }

  private resolveCommand(Path: string[]) {
    const resolvedCommandObj: ResolvedCommandObj = require(`../commands/${Path[0]}/${Path[1]}`);

    const resolvedCommandName = Object.values(resolvedCommandObj)
      .map((Command: any) => {
        const command: Command = new Command(this.bot);
        this.bot.Commands.set(command.trigger, command);

        return command.name;
      })
      .at(0);

    return resolvedCommandName as string;
  }

  async loadCommands() {
    const commandsDir: string[] = readdirSync(join(__dirname, '../commands'));

    try {
      for (const category of commandsDir) {
        this.modulesLength.push(category.length);
        const joinedCategory: string[] = readdirSync(
          join(__dirname, '../commands', category)
        );

        joinedCategory.forEach((file) => {
          if (file.endsWith('.js') || file.endsWith('.ts')) {
            const resolvedCommand = this.resolveCommand([category, file]);
            this.allCommands.push(resolvedCommand);
          }
        });
      }
    } catch (e) {
      console.error(e);
    }
  }
}
