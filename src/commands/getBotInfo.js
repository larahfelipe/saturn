async function execute(bot, msg, args) {
  msg.channel.send({
    embed: {
      author: {
        name: 'UNITY Properties',
        icon_url: bot.user.avatarURL()
      },
      description: 'Created and maintained by <@260866537798369299>',
      fields: [{
        name: 'Bot Status',
        value: `· Currently *ONLINE* and listening commands on "${msg.guild.name}" server\n· Discord API Latency: ${bot.ws.ping} ms`
      }, {
        name: 'Hosted at',
        value: '· [Heroku | Cloud App Platform](https://www.heroku.com)\n· [GitHub repository](https://github.com/felpshn/unity-bot)'
      }],
      timestamp: new Date(),
      footer: {
        icon_url: bot.user.avatarURL(),
        text: 'Unity © Discord Bot — ver 1.0'
      },
      color: 'C1FF00'
    }
  });
};

module.exports = {
  name: '.unity',
  help: 'Displays Unity properties',
  execute
};
