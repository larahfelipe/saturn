const MessageEmbed = require('discord.js').MessageEmbed;
const embed = new MessageEmbed();


async function execute(bot, msg, args) {
  embed
    .setAuthor('UNITY Properties', bot.user.avatarURL())
    .setDescription('Created and maintained by <@260866537798369299>')
    .addFields({
      name: 'Bot Status:',
      value: `· Currently *ONLINE* and listening commands on "${msg.guild.name}" server\n· Discord API Latency: ${bot.ws.ping} ms`
    },
    {
      name: 'Hosted at:',
      value: '· [Heroku | Cloud App Platform](https://www.heroku.com)\n· [GitHub repository](https://github.com/felpshn/unity-bot)'
    })
    .setTimestamp()
    .setFooter('Unity © Discord Bot — ver 1.0', bot.user.avatarURL())
    .setColor('#C1FF00');
  msg.channel.send({ embed });
};

module.exports = {
  name: '.unity',
  help: 'Displays Unity properties',
  execute
};
