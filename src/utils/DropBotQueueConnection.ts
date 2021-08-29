import { Message } from 'discord.js';

import Bot from '../structs/Bot';
import { IQueue } from '../types';

export async function dropBotQueueConnection(bot: Bot, msg: Message) {
  if (!bot.queues)
    return console.log("There's no queues established on the server.");

  bot.queues.forEach((queue: IQueue) => {
    queue.connection.disconnect();
  });
  bot.queues.delete(msg.member!.guild.id);
}
