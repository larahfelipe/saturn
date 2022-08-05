import type { Message } from 'discord.js';

import { MusicPlaybackHandler } from '@/handlers/MusicPlaybackHandler';
import type { Bot } from '@/structures/Bot';
import { Command } from '@/structures/Command';

export class Stop extends Command {
  constructor(bot: Bot) {
    super(bot, {
      name: 'Stop',
      trigger: ['stop'],
      help: 'Stops the music playback',
      isActive: true
    });
  }

  async execute(msg: Message) {
    const musicPlaybackHandler = MusicPlaybackHandler.getInstance(
      this.bot,
      msg
    );
    await musicPlaybackHandler.stop();
  }
}
