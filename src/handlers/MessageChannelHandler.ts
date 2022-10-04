import {
  ChannelType,
  type Collection,
  type CommandInteraction,
  type Interaction,
  type Message
} from 'discord.js';

export class MessageChannelHandler {
  private static INSTANCE: MessageChannelHandler;
  protected msg: Interaction | CommandInteraction;

  private constructor(msg: Interaction) {
    this.msg = msg;
  }

  static getInstance(msg: Interaction) {
    if (!MessageChannelHandler.INSTANCE)
      MessageChannelHandler.INSTANCE = new MessageChannelHandler(msg);
    return MessageChannelHandler.INSTANCE;
  }

  async getFirstHundredSent() {
    const firstHundredMsgs = await this.msg.channel?.messages.fetch({
      limit: 100
    });

    return firstHundredMsgs;
  }

  async getLastSent() {
    const lastSentMsg = await this.msg.channel?.messages.fetch({ limit: 1 });

    return lastSentMsg;
  }

  async getFirstHundredBotSent() {
    const firstHundredBotMsgs = await this.msg.channel?.messages
      .fetch({ limit: 100 })
      .then((msgs: Collection<string, Message>) => {
        return msgs.filter((msg) => msg.author.bot);
      });

    return firstHundredBotMsgs;
  }

  async getLastBotSent() {
    const lastMsgBotSent = await this.msg.channel?.messages
      .fetch({ limit: 100 })
      .then((msgs: Collection<string, Message>) => {
        return msgs.filter((msg) => msg.author.bot).first();
      });

    return lastMsgBotSent;
  }

  async bulkDelete(targetMsgs: typeof this.msg) {
    if (this.msg.channel?.type === ChannelType.DM) return;

    await this.msg.channel?.bulkDelete(targetMsgs as any, true);
  }
}
