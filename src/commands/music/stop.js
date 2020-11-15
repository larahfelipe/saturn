const { MessageEmbed } = require('discord.js');
const embed = new MessageEmbed();


async function execute(bot, msg, args) {
  let isQueueExists = bot.queues.get(msg.member.guild.id);
  if (!isQueueExists || !isQueueExists.connection) {
    msg.reply('There\'s no song playing in your current channel.');
  } else {
    embed
      .setTitle('⏹  Stop Music')
      .setDescription('Understood! Stopping the music function.')
      .setColor('#C1FF00');
    await msg.channel.send({ embed });

    isQueueExists.connection.disconnect();
    bot.queues.delete(msg.member.guild.id);
  };
};

module.exports = {
  name: '.stop',
  help: 'Stops the music function',
  execute
};
