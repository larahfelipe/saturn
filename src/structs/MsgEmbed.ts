import { MessageEmbed } from 'discord.js';

export class MsgEmbed extends MessageEmbed {
  private static INSTANCE: MsgEmbed;

  private constructor() {
    super();
  }

  static getInstance() {
    if (!MsgEmbed.INSTANCE) MsgEmbed.INSTANCE = new MsgEmbed();
    return MsgEmbed.INSTANCE;
  }
}
