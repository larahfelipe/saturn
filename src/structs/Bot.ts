import { Client, Collection, GuildMember } from 'discord.js';

import config from '@/config';
import {
  AppRequiredCredentialsError,
  AppRequiredCredentalsTypeError,
  AppCommandErrorTitle,
  AppCommandErrorDescription,
  AppErrorColor
} from '@/constants';
import { Logger } from '@/errors';
import { CommandHandler, PlaybackHandler } from '@/handlers';
import { Database, handleGuildMemberAuthenticationService } from '@/services';
import { Command, MsgEmbed } from '@/structs';
import { Queue } from '@/types';

export class Bot extends Client {
  commands!: Collection<string, Command>;
  queues!: Map<string, Queue>;
  logger!: Logger;

  constructor() {
    super();
    Bot.validateRequiredCredentials();
    Bot.tryDatabaseConnection();
    Bot.onInteractionStart(this);
  }

  private static validateRequiredCredentials() {
    if (!config.botPrefix || !config.botToken)
      throw new Error(AppRequiredCredentialsError);
    if (typeof config.botToken !== 'string')
      throw new TypeError(AppRequiredCredentalsTypeError);
  }

  private static tryDatabaseConnection() {
    if (config.dbAccess) Database.setConnection();
  }

  private static onInteractionStart(bot: Bot) {
    bot.commands = new Collection();
    bot.queues = new Map();
    bot.logger = new Logger(bot);
    new CommandHandler(bot).loadCommands();

    bot.once('ready', () => {
      console.log('[Saturn] Discord API ready.\n');
    });

    this.onInteractionListening(bot);
    this.handleClientLogin(bot);

    process.on('unhandledRejection', async (error: Error) => {
      await bot.logger.emitErrorReport(error);
    });
    process.on('uncaughtExceptionMonitor', async (error) => {
      await bot.logger.emitErrorReport(error);
    });
  }

  private static onInteractionListening(bot: Bot) {
    bot.on('message', async (msg) => {
      bot.user!.setActivity(`${config.botPrefix}help`);

      if (!msg.content.startsWith(config.botPrefix as string) || msg.author.bot)
        return;

      const embed = MsgEmbed.getInstance();
      PlaybackHandler.getInstance(bot, msg);

      try {
        const args = msg.content
          .slice(config.botPrefix!.length)
          .trim()
          .split(/ +/);
        if (!args)
          throw new Error(
            'Interaction was triggered without providing any arguments.'
          );

        const enteredCommand = config.botPrefix + args.shift()!.toLowerCase();
        const fullCommand = `${enteredCommand} ${args.join(' ')}`;
        console.log(`[@${msg.author.tag}] > ${fullCommand}`);

        const getCommand = bot.commands.get(enteredCommand);
        if (!getCommand) throw new Error(`${fullCommand} does not exist.`);

        if (Database.isConnected) {
          const getMember = await handleGuildMemberAuthenticationService(
            msg.member as GuildMember
          );
          if (!getMember)
            throw new Error(`${msg.member} is not registered in database.`);

          if (getMember.userRoleLvl >= getCommand.description.requiredRoleLvl) {
            getCommand.run(msg, args);
          } else
            throw new Error(
              `${msg.member} does not have permission to execute this command.`
            );
        } else {
          getCommand.run(msg, args);
        }
      } catch (err) {
        await bot.logger.emitErrorReport(err);

        embed
          .setAuthor(AppCommandErrorTitle)
          .setDescription(AppCommandErrorDescription)
          .setColor(AppErrorColor);
        msg.channel.send({ embed });
      }
    });
  }

  private static async handleClientLogin(bot: Bot) {
    try {
      if (config.environment !== 'development') {
        await bot.login(config.botToken);
      } else {
        await bot.login(config.botDevToken);
      }
    } catch (err) {
      bot.logger.emitErrorReport(err);
    }
  }
}
