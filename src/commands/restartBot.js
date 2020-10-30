const MessageEmbed = require('discord.js').MessageEmbed;
const embed = new MessageEmbed();


async function execute(bot, msg, args) {
  if (args.length === 0) {
    embed
      .setAuthor('Event Manager', bot.user.avatarURL())
      .setDescription('\`EXEC UNITY SHUTDOWN --RESTART NOW\`\n\nSee you soon.. 👋')
      .setFooter('All services was stopped.')
      .setColor('#C1FF00');
    await msg.channel.send({ embed });
  } else {
    embed
      .setAuthor('Event Manager', bot.user.avatarURL())
      .setDescription(`\`EXEC UNITY SHUTDOWN --RESTART --TIME ${args}s\`\n\nSee you soon.. 👋`)
      .setFooter('All services was stopped.')
      .setColor('#C1FF00');
    await msg.channel.send({ embed });
  };

  bot.destroy();

  setTimeout(() => {
    bot.login(process.env.BOT_TOKEN)
      .then(() => {
        embed
          .setAuthor('Event Manager', bot.user.avatarURL())
          .setDescription('\`EXEC UNITY INIT\`\n\nHello world! 🤗')
          .setFooter('All services are now running.')
          .setColor('#C1FF00');
        msg.channel.send({ embed });
      });
  }, Number(args) * 1000 || 0);
};

module.exports = {
  name: '.restart',
  help: 'Restarts the bot',
  execute
};
