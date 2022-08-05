import glob from 'glob';
import { join } from 'path';

import config from '@/config';
import type { Bot } from '@/structures/Bot';
import type { Command } from '@/structures/Command';

type ModulesLength = {
  [key: string]: number;
};

type ResolvedCommandObjRelativePath = {
  [key: string]: Command;
};

export class CommandsHandler {
  protected bot: Bot;
  private allCommands: string[];
  private modulesLength: ModulesLength;

  constructor(bot: Bot) {
    this.bot = bot;
    this.allCommands = [];
    this.modulesLength = {};
  }

  private calculateModulesLength(commandsPartialPath: string[]) {
    commandsPartialPath.forEach((commandPartialPath) => {
      let [moduleName] = commandPartialPath.split('/');
      if (moduleName.endsWith('.js') || moduleName.endsWith('.ts'))
        moduleName = 'root';

      Object.defineProperty(this.modulesLength, moduleName, {
        value: (this.modulesLength[moduleName] || 0) + 1,
        writable: true,
        enumerable: true,
        configurable: true
      });
    });
  }

  private resolveCommand(relativePath: string) {
    const resolvedCommandObjRelativePath: ResolvedCommandObjRelativePath = require(`../commands/${relativePath}`);

    const resolvedCommandName = Object.values(
      resolvedCommandObjRelativePath
    ).map((Command: any) => {
      const command: Command = new Command(this.bot);

      if (command.details.isActive) {
        const [defaultTrigger, altTrigger] = command.details.trigger;

        this.bot.Commands.set(config.botPrefix + defaultTrigger, command);
        if (altTrigger)
          this.bot.CommandsAlias.set(config.botPrefix + altTrigger, command);

        return command.name;
      }
    })[0];

    return resolvedCommandName as string;
  }

  getModulesLength() {
    return this.modulesLength;
  }

  async loadCommands() {
    try {
      const commandsDir = join(__dirname, '../commands');

      glob('**/*.+(js|ts)', { cwd: commandsDir }, (err, res) => {
        if (err) throw err;
        const resolvedCommandsPartialPath = res;
        this.calculateModulesLength(resolvedCommandsPartialPath);

        resolvedCommandsPartialPath.forEach((commandPath) => {
          const resolvedCommand = this.resolveCommand(commandPath);
          this.allCommands.push(resolvedCommand);
        });
      });
      return this.allCommands;
    } catch (e) {
      console.error(e);
    }
  }
}
