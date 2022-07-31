import { MessageEmbed } from 'discord.js';

export class Embed extends MessageEmbed {
  private static INSTANCE: Embed;

  private constructor() {
    super();
  }

  static getInstance() {
    if (!Embed.INSTANCE) Embed.INSTANCE = new Embed();
    return Embed.INSTANCE;
  }
}
