async function execute(bot, msg, args) {
  msg.channel.send({
    embed: {
      author: {
        name: 'Server Information',
        icon_url: msg.guild.iconURL()
      },
      fields: [{
        name: 'Server name',
        value: msg.guild.name
      }, {
        name: 'Total members',
        value: msg.guild.memberCount + ' user(s)'
      }],
      color: 'C1FF00'
    }
  });
};

module.exports = {
  name: '.server',
  help: 'Displays server information',
  execute
};
