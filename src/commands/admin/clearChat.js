module.exports = {
  name: '.clear',
  help: 'Cleans the messages in the current text channel',
  execute: async function (bot, msg, args) {
    let fetchedMsgs;
    do {
      fetchedMsgs = await msg.channel.messages.fetch({ limit: 100 });
      msg.channel.bulkDelete(fetchedMsgs);
    } while (fetchedMsgs.size >= 2);
  }
};
