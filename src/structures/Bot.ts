import { Client, Collection } from 'discord.js';

import config from '@/config';
import {
  APP_COMMAND_ERROR_DESCRIPTION,
  APP_COMMAND_ERROR_TITLE,
  APP_ERROR_COLOR,
  APP_MISSING_REQUIRED_CREDENTIALS,
  APP_READY
} from '@/constants';
import { InvalidAppCommand } from '@/errors/InvalidAppCommand';
import { MissingRequiredCredentialsError } from '@/errors/MissingRequiredCredentialsError';
import { UncaughtExceptionMonitorError } from '@/errors/UncaughtExceptionMonitorError';
import { UnhandledPromiseRejectionError } from '@/errors/UnhandledPromiseRejectionError';
import { CommandsHandler } from '@/handlers/CommandsHandler';
import type { AudioPlayer } from '@/types';
import { getCommand } from '@/utils/GetCommand';
import { isChatInputCommand } from '@/utils/ValidateChatInputCommand';

import type { Command } from './Command';
import { Embed } from './Embed';

export class Bot extends Client {
  Commands!: Collection<string, Command>;
  AudioPlayers!: Map<string, AudioPlayer>;

  constructor() {
    super();
    this.validateRequiredCredentials();
    this.onCreateInteraction(this);
  }

  private validateRequiredCredentials() {
    const { botToken, botPrefix } = config;

    if (!botToken || !botPrefix) {
      throw new MissingRequiredCredentialsError(
        APP_MISSING_REQUIRED_CREDENTIALS
      );
    }
  }

  private onCreateInteraction(bot: Bot) {
    bot.Commands = new Collection();
    bot.AudioPlayers = new Map();
    new CommandsHandler(bot).loadCommands();

    bot.once('ready', () => console.log(APP_READY));

    bot.on('shardError', (e) =>
      console.error('WebSocket connection error:', e)
    );
    process.on(
      'unhandledRejection',
      (e: Error) => new UnhandledPromiseRejectionError(e.message)
    );
    process.on(
      'uncaughtExceptionMonitor',
      (e: Error) => new UncaughtExceptionMonitorError(e.message)
    );

    this.onListeningInteraction(bot);
    this.makeDiscordAPIConnection(bot);
  }

  private onListeningInteraction(bot: Bot) {
    bot.on('message', async (msg) => {
      bot.user?.setActivity('with your feelings');

      if (!isChatInputCommand(msg)) return;

      const embed = Embed.getInstance();

      try {
        const { formatted, trigger, args } = getCommand(msg);
        console.log(`@${msg.author.tag} -> ${formatted}`);

        const command = bot.Commands.get(trigger);
        if (!command)
          throw new InvalidAppCommand(`${trigger} is not a valid command`);

        await command.execute(msg, args);
      } catch (e) {
        console.error(e);
        embed
          .setAuthor(APP_COMMAND_ERROR_TITLE)
          .setDescription(APP_COMMAND_ERROR_DESCRIPTION)
          .setColor(APP_ERROR_COLOR);
        msg.channel.send({ embed });
      }
    });
  }

  private async makeDiscordAPIConnection(bot: Bot) {
    try {
      await bot.login(config.botToken);
    } catch (e) {
      console.error(e);
    }
  }
}
