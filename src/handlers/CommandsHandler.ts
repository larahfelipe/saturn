import { REST } from '@discordjs/rest';
import {
  Routes,
  type CacheType,
  type CommandInteraction,
  type Interaction,
  type RESTPostAPIApplicationCommandsJSONBody
} from 'discord.js';
import glob from 'glob';
import { join } from 'path';

import config from '@/config';
import { BLANK_CHAR } from '@/constants';
import { InvalidAppCommandError } from '@/errors/InvalidAppCommandError';
import type { Bot } from '@/structures/Bot';
import type { Command } from '@/structures/Command';

type ModulesLength = {
  [key: string]: number;
};

type ResolvedCommandObjRelativePath = {
  [key: string]: Command;
};

export class CommandsHandler {
  private static INSTANCE: CommandsHandler;
  protected bot: Bot;
  private slashCommands: RESTPostAPIApplicationCommandsJSONBody[];
  private modulesLength: ModulesLength;

  private constructor(bot: Bot) {
    this.bot = bot;
    this.slashCommands = [];
    this.modulesLength = {};
  }

  static getInstance(bot: Bot) {
    if (!CommandsHandler.INSTANCE)
      CommandsHandler.INSTANCE = new CommandsHandler(bot);
    return CommandsHandler.INSTANCE;
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
      });
      isCommandsLoaded = true;
    } catch (e) {
      console.error(e);
    } finally {
      // eslint-disable-next-line no-unsafe-finally
      return isCommandsLoaded;
    }
  }

  async execute(interaction: Interaction<CacheType>) {
    if (!interaction.isCommand()) return;

    await interaction.deferReply();

    const command = this.bot.commands.get(interaction.commandName);
    if (!command)
      throw new InvalidAppCommandError({
        message: `${interaction.commandName} is not a valid command.`,
        bot: this.bot,
        interaction
      });

    console.log(
      `\n> @${interaction.user.tag} triggered "${interaction.commandName}" command.`
    );

    await command.execute(interaction);
    if (!interaction.replied) await this.signExecution(interaction);
  }

  private async signExecution(interaction: CommandInteraction) {
    await interaction.followUp(BLANK_CHAR);
  }
}
