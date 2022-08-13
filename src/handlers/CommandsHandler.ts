import { REST } from '@discordjs/rest';
import {
  Routes,
  type RESTPostAPIApplicationCommandsJSONBody
} from 'discord.js';
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
  private slashCommands: RESTPostAPIApplicationCommandsJSONBody[];
  private modulesLength: ModulesLength;

  constructor(bot: Bot) {
    this.bot = bot;
    this.slashCommands = [];
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

    const resolvedCommand = Object.values(resolvedCommandObjRelativePath).map(
      (Command: any) => {
        const command: Command = new Command(this.bot);

        if (command.data.isActive) {
          this.bot.commands.set(command.data.build.name, command);

          const builtCommandToJson = command.data.build.toJSON();
          return builtCommandToJson;
        }
      }
    )[0];

    return resolvedCommand;
  }

  private async setDiscordSlashCommandsAPI() {
    const rest = new REST({ version: '10' }).setToken(config.botToken);

    await rest.put(
      Routes.applicationGuildCommands(config.botAppId, config.guildId),
      { body: this.slashCommands }
    );
  }

  getModulesLength() {
    return this.modulesLength;
  }

  async loadCommands() {
    let isCommandsLoaded = false;

    try {
      const commandsDir = join(__dirname, '../commands');

      glob('**/*.+(js|ts)', { cwd: commandsDir }, async (err, res) => {
        if (err) throw err;
        const resolvedCommandsPartialPath = res;
        this.calculateModulesLength(resolvedCommandsPartialPath);

        resolvedCommandsPartialPath.forEach((commandPath) => {
          const resolvedSlashCommand = this.resolveCommand(commandPath);

          if (resolvedSlashCommand)
            this.slashCommands.push(resolvedSlashCommand);
        });

        await this.setDiscordSlashCommandsAPI();
        isCommandsLoaded = true;
      });
    } catch (e) {
      console.error(e);
    } finally {
      // eslint-disable-next-line no-unsafe-finally
      return isCommandsLoaded;
    }
  }
}
