const { MessageEmbed } = require('discord.js');
const embed = new MessageEmbed();

const { playSong } = require('./play');


async function execute(bot, msg, args) {
  let isQueueExists = bot.queues.get(msg.member.guild.id);
  if (!isQueueExists) {
    msg.reply('There\'s no song playing.');
  } else {
    try {
      if (isQueueExists.songs.length > 1) {
        isQueueExists.songs.shift();
        isQueueExists.author.shift();
        
        embed
          .setTitle('⏭  Skip Music')
          .setDescription('Okay! Setting up the next song for you.')
          .setColor('#C1FF00');
        await msg.channel.send({ embed });

        playSong(bot, msg, isQueueExists.songs[0], isQueueExists.author);
      } else {
        msg.reply('There\'s no songs queued.');
      };
    } catch (e) {
      console.error(e);
    };
  };
};

module.exports = {
  name: '.skip',
  help: 'Skips the current song',
  execute
};
