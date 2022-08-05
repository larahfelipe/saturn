import { Client, Collection } from 'discord.js';

import config from '@/config';
import {
  APP_COMMANDS_LOADED,
  APP_COMMAND_ERROR_DESCRIPTION,
  APP_COMMAND_ERROR_TITLE,
  APP_ERROR_COLOR,
  APP_MISSING_REQUIRED_CREDENTIALS,
  APP_READY
} from '@/constants';
import { GeneralAppError } from '@/errors/GeneralAppError';
import { InvalidAppCommandError } from '@/errors/InvalidAppCommandError';
import { MissingRequiredCredentialsError } from '@/errors/MissingRequiredCredentialsError';
import { UncaughtExceptionMonitorError } from '@/errors/UncaughtExceptionMonitorError';
import { UnhandledPromiseRejectionError } from '@/errors/UnhandledPromiseRejectionError';
import { AppErrorHandler } from '@/handlers/AppErrorHandler';
import { CommandsHandler } from '@/handlers/CommandsHandler';
import { MessageChannelHandler } from '@/handlers/MessageChannelHandler';
import { PrismaClient } from '@/infra/PrismaClient';
import type { AudioPlayer } from '@/types';
import { getCommand } from '@/utils/GetCommand';
import { isChatInputCommand } from '@/utils/ValidateChatInputCommand';

import type { Command } from './Command';
import { Embed } from './Embed';

export class Bot extends Client {
  private static INSTANCE: Bot;
  DatabaseClient!: PrismaClient;
  AppErrorHandler!: AppErrorHandler;
  MessageChannelHandler!: MessageChannelHandler;
  Commands!: Collection<string, Command>;
  CommandsAlias!: Collection<string, Command>;
  AudioPlayers!: Map<string, AudioPlayer>;

  private constructor() {
    super();
    this.validateRequiredCredentials();
    this.maybeMakeDatabaseConnection();
    this.onCreateInteraction();
    this.onListeningInteraction();
    this.makeDiscordAPIConnection();
  }

  static getInstance() {
    if (!this.INSTANCE) this.INSTANCE = new Bot();
    return this.INSTANCE;
  }

  private validateRequiredCredentials() {
    const { botToken, botPrefix } = config;

    if (!botToken || !botPrefix) {
      throw new MissingRequiredCredentialsError(
        APP_MISSING_REQUIRED_CREDENTIALS
      );
    }
  }

  private async maybeMakeDatabaseConnection() {
    this.DatabaseClient = PrismaClient.getInstance();
    await this.DatabaseClient.createConnection();

    this.AppErrorHandler = AppErrorHandler.getInstance(this);
  }

  private async onCreateInteraction() {
    this.Commands = new Collection();
    this.CommandsAlias = new Collection();
    this.AudioPlayers = new Map();
    const loadedCommands = await new CommandsHandler(this).loadCommands();
    if (loadedCommands) console.log(APP_COMMANDS_LOADED);

    this.once('ready', () => console.log(APP_READY));

    this.on(
      'shardError',
      ({ message }) => new GeneralAppError({ message, bot: this })
    );
    process.on(
      'unhandledRejection',
      ({ message }: Error) =>
        new UnhandledPromiseRejectionError({ message, bot: this })
    );
    process.on(
      'uncaughtExceptionMonitor',
      ({ message }: Error) =>
        new UncaughtExceptionMonitorError({ message, bot: this })
    );
  }

  private onListeningInteraction() {
    this.on('message', async (msg) => {
      this.MessageChannelHandler = MessageChannelHandler.getInstance(msg);
      const embed = Embed.getInstance();

      this.user?.setActivity(`Orbiting in ${msg.guild?.name}`);

      if (!isChatInputCommand(msg)) return;

      try {
        const { formatted, trigger, args } = getCommand(msg);
        console.log(`\n@${msg.author.tag} -> ${formatted}`);

        const command =
          this.Commands.get(trigger) || this.CommandsAlias.get(trigger);

        if (!command)
          throw new InvalidAppCommandError({
            message: `${trigger} is not a valid command.`,
            bot: this,
            interaction: msg
          });

        await command.execute(msg, args);
      } catch (e) {
        console.error(e);

        embed
          .setTitle('')
          .setAuthor(APP_COMMAND_ERROR_TITLE)
          .setThumbnail('')
          .setDescription(APP_COMMAND_ERROR_DESCRIPTION)
          .setFooter('')
          .setTimestamp({} as Date)
          .setColor(APP_ERROR_COLOR);
        msg.channel.send({ embed });
      }
    });
  }

  private async makeDiscordAPIConnection() {
    try {
      await this.login(config.botToken);
    } catch (e) {
      console.error(e);
    }
  }
}
