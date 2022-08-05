import type { Message } from 'discord.js';

import { MusicPlaybackHandler } from '@/handlers/MusicPlaybackHandler';
import type { Bot } from '@/structures/Bot';
import { Command } from '@/structures/Command';

export class Skip extends Command {
  constructor(bot: Bot) {
    super(bot, {
      name: 'Skip',
      trigger: ['skip'],
      help: 'Skips the current track',
      isActive: true
    });
  }

  async execute(msg: Message) {
    const musicPlaybackHandler = MusicPlaybackHandler.getInstance(
      this.bot,
      msg
    );
    await musicPlaybackHandler.skip();
  }
}
