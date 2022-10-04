import {
  EmbedBuilder,
  type ColorResolvable,
  type CommandInteraction,
  type EmbedAuthorData,
  type EmbedFooterData,
  type Interaction
} from 'discord.js';

import type { RGBVector } from '@/types';

type EmbedData = {
  title?: string;
  author?: EmbedAuthorData;
  thumbnail?: string;
  description?: string;
  image?: string;
  footer?: EmbedFooterData;
  timestamp?: Date;
  color?: string | RGBVector;
};

export class Embed extends EmbedBuilder {
  private static INSTANCE: Embed;

  private constructor() {
    super();
  }

  static getInstance() {
    if (!Embed.INSTANCE) Embed.INSTANCE = new Embed();
    return Embed.INSTANCE;
  }

  async build(interaction: Interaction | CommandInteraction, data: EmbedData) {
    try {
      this.setTitle(data.title ?? null);
      this.setAuthor(data.author ?? null);
      this.setThumbnail(data.thumbnail ?? null);
      this.setDescription(data.description ?? null);
      this.setImage(data.image ?? null);
      this.setFooter(data.footer ?? null);
      this.setTimestamp(data.timestamp ?? null);
      this.setColor((data.color as ColorResolvable) ?? null);

      await interaction.channel?.send({ embeds: [this] });
    } catch (e) {
      console.error(e);
    }
  }
}
