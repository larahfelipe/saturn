const Discord = require('discord.js');

const bot = new Discord.Client();
bot.commands = new Discord.Collection();
bot.queues = new Map();
const embed = new Discord.MessageEmbed();

const dotenv = require('dotenv');
dotenv.config();

const fs = require('fs');
const path = require('path');

const commandsDir = fs.readdirSync(path.join(__dirname, '/commands'));
commandsDir.filter(file => {
  file.endsWith('.js');
});
for (let file of commandsDir) {
  const handleCommand = require(`./commands/${file}`);
  bot.commands.set(handleCommand.name, handleCommand);
};


bot.once('ready', () => {
  console.log('\n[unity] Okay, I\'m listening ...\n');
});

bot.on('message', async msg => {
  bot.user.setActivity('.help');

  const prefix = process.env.BOT_PREFIX;
  if (!msg.content.startsWith(prefix) || msg.author.bot) return;

  const args = msg.content.slice(prefix.length).trim().split(/ +/);
  const commandListener = prefix + args.shift().toLowerCase();
  console.log(`[@${msg.author.tag}] >> ${commandListener} ${args.join(' ')}`);

  try {
    bot.commands.get(commandListener).execute(bot, msg, args);
  } catch (e) {
    console.error(e);
    embed
      .setAuthor('🤖 Error 404: Command not found!')
      .setDescription('If you need help with commands type **\`.help\`**')
      .setColor('#C1FF00');
    msg.channel.send({ embed });
  };
});

bot.login(process.env.BOT_TOKEN);
