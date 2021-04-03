import { Message } from 'discord.js';

export class FetchMessages {
  static async firstHundredSent(msg: Message) {
    const firstHundredMsgs = await msg.channel.messages.fetch({ limit: 100 });
    return firstHundredMsgs;
  }

  static async lastSent(msg: Message) {
    const lastSentMsg = await msg.channel.messages.fetch({ limit: 1 });
    return lastSentMsg;
  }

  static async firstHundredBotSent(msg: Message) {
    const firstHundredBotMsgs = await msg.channel.messages.fetch({ limit: 100 })
      .then(msgs => {
        const botMsgs = msgs.map(currMsg => {
          if (currMsg.author.bot) {
            return currMsg;
          }
        });
        return botMsgs;
      });
    return firstHundredBotMsgs;
  }

  static async lastBotSent(msg: Message) {
    const lastSentBotMsg = await msg.channel.messages.fetch({ limit: 100 })
      .then(msgs => {
        const botMsg = msgs.map(currMsg => {
          if (currMsg.author.bot) {
            return currMsg;
          }
        });
        return botMsg[0];
      });
    return lastSentBotMsg;
  }
}
