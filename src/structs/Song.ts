import { Message } from 'discord.js';

import Bot from './Bot';

abstract class Song {
  bot: Bot;
  msg: Message;

  constructor(bot: Bot, msg: Message) {
    this.bot = bot;
    this.msg = msg;
  }

  abstract setSong(song: any, requestAuthor: string): Promise<any>;
}

export default Song;
