import { Message } from 'discord.js';

export class MessageHandler {
  static async firstHundredSent(msg: Message) {
    return await msg.channel.messages.fetch({ limit: 100 });
  }

  static async lastSent(msg: Message) {
    return await msg.channel.messages.fetch({ limit: 1 });
  }

  static async firstHundredBotSent(msg: Message) {
    const firstHundredBotMsgs = await msg.channel.messages
      .fetch({ limit: 100 })
      .then((msgs) => {
        return msgs.filter((msg) => msg.author.bot);
      });
    return firstHundredBotMsgs;
  }

  static async lastBotSent(msg: Message) {
    const lastSentBotMsg = await msg.channel.messages
      .fetch({ limit: 100 })
      .then((msgs) => {
        return msgs.filter((msg) => msg.author.bot).first();
      });
    return lastSentBotMsg;
  }
}
