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
    return this.msg.channel?.messages.fetch({
      limit: 100
    });
  }

  async getLastSent() {
    return this.msg.channel?.messages.fetch({ limit: 1 });
  }

  async getFirstHundredBotSent() {
    return this.msg.channel?.messages
      .fetch({ limit: 100 })
      .then((msgs: Collection<string, Message>) => {
        return msgs.filter((msg) => msg.author.bot);
      });
  }

  async getLastBotSent() {
    return this.msg.channel?.messages
      .fetch({ limit: 100 })
      .then((msgs: Collection<string, Message>) => {
        return msgs.filter((msg) => msg.author.bot).first();
      });
  }

  async bulkDelete(targetMsgs: typeof this.msg) {
    if (this.msg.channel?.type === ChannelType.DM) return;

    await this.msg.channel?.bulkDelete(targetMsgs as any, true);
  }
}
