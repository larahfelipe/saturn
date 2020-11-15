async function execute(bot, msg, args) {
  const isQueueExists = bot.queues.get(msg.member.guild.id);
  if (!isQueueExists) {
    return msg.reply('There\'s no queue established in the server.');
  };

  const queue = isQueueExists.songs;
  let concatQueueStr = '';
  queue.forEach(song => {
    if (queue.indexOf(song) === 0) return;
    concatQueueStr += `**${queue.indexOf(song)}** — ${song.title} \`[${song.timestamp}]\`\n`;
  });

  msg.channel.send({
    embed: {
      title: '📃  Music Queue',
      fields: [{
        name: 'Currently Listening',
        value: `🔊  ***${queue[0].title}***`
      }, {
        name: 'Coming Next',
        value: concatQueueStr
      }],
      color: 'C1FF00'
    }
  });
};

module.exports = {
  name: '.queue',
  help: 'Shows the server\'s music queue',
  execute
};
