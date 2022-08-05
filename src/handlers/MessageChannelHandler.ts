import type { Collection, Message } from 'discord.js';

export class MessageChannelHandler {
  private static INSTANCE: MessageChannelHandler;
  protected msg: Message;

  private constructor(msg: Message) {
    this.msg = msg;
  }

  static getInstance(msg: Message) {
    if (!MessageChannelHandler.INSTANCE)
      MessageChannelHandler.INSTANCE = new MessageChannelHandler(msg);
    return MessageChannelHandler.INSTANCE;
  }

  async getFirstHundredSent() {
    return await this.msg.channel.messages.fetch({ limit: 100 });
  }

  async getLastSent() {
    return await this.msg.channel.messages.fetch({ limit: 1 });
  }

  async getFirstHundredBotSent() {
    const firstHundredBotMsgs = await this.msg.channel.messages
      .fetch({ limit: 100 })
      .then((msgs) => {
        return msgs.filter((msg) => msg.author.bot);
      });
    return firstHundredBotMsgs;
  }

  async getLastBotSent() {
    const lastMsgBotSent = await this.msg.channel.messages
      .fetch({ limit: 100 })
      .then((msgs) => {
        return msgs.filter((msg) => msg.author.bot).first();
      });
    return lastMsgBotSent;
  }

  async bulkDelete(targetMsgs: Collection<string, Message>) {
    if (this.msg.channel.type === 'dm') return;

    await this.msg.channel.bulkDelete(targetMsgs);
  }

  async delete(targetMsg: Message) {
    if (this.msg.channel.type === 'dm') return;

    await targetMsg.delete();
  }
}
