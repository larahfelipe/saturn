module.exports = {
  dropConnection(bot, msg, args) {
    bot.queues.forEach(queue => {
      if (queue.connection) {
        queue.connection.disconnect();
      };
      bot.queues.delete(msg.member.guild.id);
    });
  }
};
