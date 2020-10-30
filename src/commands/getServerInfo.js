const MessageEmbed = require('discord.js').MessageEmbed;
const embed = new MessageEmbed();


async function execute(bot, msg, args) {
  embed
    .setAuthor('Server Information', msg.guild.iconURL())
    .addFields({
      name: 'Server name:',
      value: msg.guild.name
    },
    {
      name: 'Total members:',
      value: msg.guild.memberCount + ' user(s)'
    })
    .setColor('#C1FF00');
  msg.channel.send({ embed });
};

module.exports = {
  name: '.server',
  help: 'Displays server information',
  execute
};
