import { EmbedBuilder } from 'discord.js';

export class Embed extends EmbedBuilder {
  private static INSTANCE: Embed;

  private constructor() {
    super();
  }

  static getInstance() {
    if (!Embed.INSTANCE) Embed.INSTANCE = new Embed();
    return Embed.INSTANCE;
  }
}
