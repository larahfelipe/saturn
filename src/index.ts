import config from './config';
import { Database } from './utils/DatabaseConnection';
import { Commands } from './utils/CommandsHandler';
import { handleMemberAuth } from './services/AuthenticateMemberService';

import Discord, { Message } from 'discord.js';

if (!config.botPrefix || !config.botToken) throw new Error('Prefix and/or token not settled.');

let hasDBConnection = false;
if (config.dbAccess) {
  console.log('\n[Saturn] Requesting access to database ...\n');
  Database.setConnection();
  hasDBConnection = Database.isConnected;
}

export class Bot extends Discord.Client {
  commands!: Discord.Collection<string, any>;
  queues!: Map<string, any>;
}

const bot = new Bot();
bot.commands = new Discord.Collection();
const embed = new Discord.MessageEmbed();
bot.queues = new Map();
Commands.loadAndSet(bot);


bot.once('ready', () => {
  console.log('[Saturn] Discord API ready.\n');
});

bot.on('message', async (msg: Message) => {
  bot.user?.setActivity(`${config.botPrefix}help`);

  if (!msg.content.startsWith(config.botPrefix!) || msg.author.bot) return;

  const args = msg.content.slice(config.botPrefix!.length).trim().split(/ +/);
  const commandListener = config.botPrefix! + args.shift()?.toLowerCase();
  console.log(`[@${msg.author.tag}] >> ${commandListener} ${args.join(' ')}`);

  const getCommand = bot.commands.get(commandListener);

  try {
    if (hasDBConnection) {
      const getMember = await handleMemberAuth(msg.member!);
      if (!getMember) return msg.reply('Cannot execute your command because you\'re not registered in database!');

      if (getMember.roleLvl >= getCommand.permissionLvl) {
        getCommand.run(bot, msg, args);
      } else {
        msg.reply('You don\'t have permission to use this command!');
      }
    } else getCommand.run(bot, msg, args);
  } catch (err) {
    console.error(err);
    embed
      .setAuthor('❌ Whoops, a wild error appeared!')
      .setDescription(`**Why I\'m seeing this?!** 🤔\n\nYou probably have a typo in your command\'s message or you currently don\'t have permission to execute this command.\n\nYou can get a full commands list by typing **\`${config.botPrefix!}help\`**`)
      .setColor('#6E76E5');
    msg.channel.send({ embed });
  }
});

if (process.env.NODE_ENV !== 'development') {
  bot.login(config.botToken);
} else bot.login(config.botDevToken);
