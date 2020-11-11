async function execute(bot, msg, args) {
  let isQueueExists = bot.queues.get(msg.member.guild.id);
  if (!isQueueExists || !isQueueExists.connection) {
    msg.reply('There\'s no song playing in your current channel.');
  } else {
    isQueueExists.connection.dispatcher.pause();
  };
};

module.exports = {
  name: '.pause',
  help: 'Pauses the current song',
  execute
};
