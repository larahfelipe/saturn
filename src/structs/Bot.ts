import { Client, Collection, Message, MessageEmbed } from 'discord.js';

import config from '../config';
import Database from '../utils/Database';
import CommandHandler from '../handlers/CommandHandler';
import { handleGuildMemberAuth } from '../services/AuthenticateGuildMemberService';

class Bot extends Client {
  commands!: Collection<string, any>;
  queues!: Map<string, any>;
  private static hasDatabaseConnection: boolean;

  private static validateRequiredCredentials() {
    if (typeof config.botToken !== 'string')
      throw new TypeError('Tokens must be of type string.');
    if (!config.botPrefix) throw new Error('Prefix not settled.');
  }

  private static async handleDatabaseConnection() {
    if (config.dbAccess) {
      try {
        Database.setConnection();
      } catch (err) {
        throw new Error(err);
      } finally {
        this.hasDatabaseConnection = Database.isConnected;
      }
    }
  }

  private static async handleClientLogin(bot: Bot) {
    try {
      if (process.env.NODE_ENV !== 'development') {
        await bot.login(config.botToken);
      } else {
        await bot.login(config.botDevToken);
      }
    } catch (err) {
      console.error(err);
    }
  }

  private static onInteractionReady(bot: Bot) {
    bot.on('message', async (msg: Message) => {
      bot.user?.setActivity(`${config.botPrefix}help`);

      if (!msg.content.startsWith(config.botPrefix!) || msg.author.bot) return;

      const embed = new MessageEmbed();
      const args: string[] = msg.content
        .slice(config.botPrefix!.length)
        .trim()
        .split(/ +/);
      const commandListener = config.botPrefix! + args.shift()?.toLowerCase();
      const getCommand = bot.commands.get(commandListener);
      console.log(
        `[@${msg.author.tag}] > ${commandListener} ${args.join(' ')}`
      );

      try {
        if (this.hasDatabaseConnection) {
          const getMember = await handleGuildMemberAuth(msg.member!);
          if (!getMember) {
            msg.reply(
              "Cannot execute your command because you're not registered in database."
            );
          } else if (
            getMember.userRoleLvl >= getCommand.description.requiredRoleLvl
          ) {
            getCommand.run(msg, args);
          } else {
            msg.reply("You don't have permission to use this command.");
          }
        } else {
          getCommand.run(msg, args);
        }
      } catch (err) {
        console.error(err);
        embed
          .setAuthor('❌ Whoops, a wild error appeared!')
          .setDescription(
            `**Why I\'m seeing this?!** 🤔\n\nYou probably have a typo in your command\'s message or you currently don\'t have permission to execute this command.\n\nYou can get a full commands list by typing **\`${config.botPrefix!}help\`**`
          )
          .setColor('#6E76E5');
        msg.channel.send({ embed });
      }
    });
  }

  private static onInteractionInit() {
    const bot = new Bot();
    bot.commands = new Collection();
    bot.queues = new Map();
    new CommandHandler(bot).loadCommands();

    bot.once('ready', () => {
      console.log('[Saturn] Discord API ready.\n');
    });

    this.onInteractionReady(bot);
    this.handleClientLogin(bot);
  }

  static start() {
    try {
      this.validateRequiredCredentials();
      this.handleDatabaseConnection();
      this.onInteractionInit();
    } catch (err) {
      console.error(err);
    }
  }
}

export default Bot;
