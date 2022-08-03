import { Message } from 'discord.js';

import { Bot } from '@/structures/Bot';

export class MusicPlaybackHandler {
  private static INSTANCE: MusicPlaybackHandler;
  protected bot: Bot;
  protected msg: Message;

  private constructor(bot: Bot, msg: Message) {
    this.bot = bot;
    this.msg = msg;
  }

  static getInstance(bot: Bot, msg: Message) {
    if (
      !this.INSTANCE ||
      this.INSTANCE.msg.guild?.id !== msg.guild?.id ||
      this.INSTANCE.msg.author.id !== msg.author.id
    )
      this.INSTANCE = new MusicPlaybackHandler(bot, msg);
    return this.INSTANCE;
  }
}
