const MessageEmbed = require('discord.js').MessageEmbed;
const embed = new MessageEmbed();


async function execute(bot, msg, args) {
  let concatHelpStr = '';
  bot.commands.forEach(command => {
    if (command.help) {
      concatHelpStr += `\`${command.name}\` → ${command.help}.\n`;
    };
  });
  embed
    .setAuthor('UNITY Commands Help', bot.user.avatarURL())
    .setDescription(concatHelpStr)
    .setColor('#C1FF00');
  msg.channel.send({ embed });
};

module.exports = {
  name: '.help',
  help: 'Commands help',
  execute
};
