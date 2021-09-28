import { Client, Collection, MessageEmbed, GuildMember } from 'discord.js';

import config from '@/config';
import Command from './Command';
import Logger from '@/utils/Logger';
import Database from '@/utils/Database';
import CommandHandler from '@/handlers/CommandHandler';
import { handleGuildMemberAuth } from '@/services/AuthenticateGuildMemberService';
import { IQueue } from '@/types';

export default class Bot extends Client {
  commands!: Collection<string, Command>;
  queues!: Map<string, IQueue>;
  logger!: Logger;

  constructor() {
    super();
    Bot.validateRequiredCredentials();
    Bot.handleDatabaseConnection();
    Bot.onInteractionStart(this);
  }

  private static validateRequiredCredentials() {
    if (!config.botPrefix || !config.botToken)
      throw new Error('Prefix and/or Token not settled.');
    if (typeof config.botToken !== 'string')
      throw new TypeError('Tokens must be of type string.');
  }

  private static handleDatabaseConnection() {
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
      await bot.logger.handleErrorEvent(error);
    });
    process.on('uncaughtExceptionMonitor', async (error) => {
      await bot.logger.handleErrorEvent(error);
    });
  }

  private static onInteractionListening(bot: Bot) {
    bot.on('message', async (msg) => {
      bot.user!.setActivity(`${config.botPrefix}help`);

      if (!msg.content.startsWith(config.botPrefix as string) || msg.author.bot)
        return;

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
          const getMember = await handleGuildMemberAuth(
            msg.member as GuildMember
          );
          if (!getMember)
            throw new Error(`${msg.member} is not registered in database.`);

          if (
            getMember.userRoleLvl >= getCommand!.description.requiredRoleLvl
          ) {
            getCommand!.run(msg, args);
          } else
            throw new Error(
              `${msg.member} does not have permission to execute this command.`
            );
        } else {
          getCommand!.run(msg, args);
        }
      } catch (err) {
        await bot.logger.handleErrorEvent(err);

        const embed = new MessageEmbed();
        embed
          .setAuthor('❌ Whoops, a wild error appeared!')
          .setDescription(
            `Why I'm seeing this?! 🤔\n\nYou probably have a typo in your command's message or you currently don't have permission to execute this command.\n\nYou can get a full commands list by typing \`${config.botPrefix}help\``
          )
          .setColor(config.errorColor);
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
      console.error(err);
    }
  }
}
