import { Client, Collection, Message, MessageEmbed } from 'discord.js';

import config from '../config';
import Database from '../utils/Database';
import CommandHandler from '../handlers/CommandHandler';
import { handleMemberAuth } from '../services/AuthenticateMemberService';

class Bot extends Client {
  static hasDatabaseConnection: boolean;
  commands!: Collection<string, any>;
  queues!: Map<string, any>;

  private static validateCredentials() {
    if (typeof config.botToken !== 'string' || typeof config.botDevToken !== 'string') throw new TypeError('Tokens must be of type string.');
    if (!config.botPrefix) throw new Error('Prefix not settled.');
  }

  private static handleDatabaseConnection() {
    if (config.dbAccess) {
      console.log('\n[Saturn] Requesting access to database ...\n');
      Database.setConnection();
      this.hasDatabaseConnection = Database.isConnected;
    }
  }

  private static async handleLogin(bot: Bot) {
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

  private static onSetupState() {
    const bot = new Bot();
    bot.commands = new Collection();
    bot.queues = new Map();
    new CommandHandler(bot).loadCommands();

    bot.once('ready', () => {
      console.log('[Saturn] Discord API ready.\n');
    });

    this.onReadyState(bot);
    this.handleLogin(bot);
  }

  private static onReadyState(bot: Bot) {
    bot.on('message', async (msg: Message) => {
      bot.user?.setActivity(`${config.botPrefix}help`);

      if (!msg.content.startsWith(config.botPrefix!) || msg.author.bot) return;

      const args = msg.content.slice(config.botPrefix!.length).trim().split(/ +/);
      const commandListener = config.botPrefix! + args.shift()?.toLowerCase();
      console.log(`[@${msg.author.tag}] >> ${commandListener} ${args.join(' ')}`);

      const embed = new MessageEmbed();
      const getCommand = bot.commands.get(commandListener);

      try {
        if (this.hasDatabaseConnection) {
          const getMember = await handleMemberAuth(msg.member!);
          if (!getMember) return msg.reply('Cannot execute your command because you\'re not registered in database!');

          if (getMember.roleLvl >= getCommand.permissionLvl) {
            getCommand.run(msg, args);
          } else {
            msg.reply('You don\'t have permission to use this command!');
          }
        } else getCommand.run(msg, args);
      } catch (err) {
        console.error(err);
        embed
          .setAuthor('❌ Whoops, a wild error appeared!')
          .setDescription(`**Why I\'m seeing this?!** 🤔\n\nYou probably have a typo in your command\'s message or you currently don\'t have permission to execute this command.\n\nYou can get a full commands list by typing **\`${config.botPrefix!}help\`**`)
          .setColor('#6E76E5');
        msg.channel.send({ embed });
      }
    });
  }

  static start() {
    this.validateCredentials();
    this.handleDatabaseConnection();
    this.onSetupState();
  }
}

export default Bot;
