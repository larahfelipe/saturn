import { Message } from 'discord.js';
import { Bot } from '..';

export async function dropBotQueueConnection (bot: Bot, msg: Message) {
  bot.queues.forEach(queue => {
    queue.connection.disconnect();
  });
  bot.queues.delete(msg.member!.guild.id);
}
