async function execute(bot, msg, args) {
  let isQueueExists = bot.queues.get(msg.member.guild.id);
  if (!isQueueExists || !isQueueExists.connection) {
    msg.reply('There\'s no song playing in your current channel.');
  } else {
    isQueueExists.connection.dispatcher.resume();
  };
};

module.exports = {
  name: '.resume',
  help: 'Resumes the current song',
  execute
};
