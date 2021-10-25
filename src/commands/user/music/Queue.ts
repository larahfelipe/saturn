import { Message, MessageEmbed } from 'discord.js';

import config from '@/config';
import Bot from '@/structs/Bot';
import Command from '@/structs/Command';

export default class Queue extends Command {
  constructor(bot: Bot) {
    super(bot, {
      name: `${config.botPrefix}queue`,
      help: "Show the server's music queue",
      requiredRoleLvl: 0
    });
  }

  async run(msg: Message) {
    const queueExists = this.bot.queues.get(msg.guild!.id);
    if (!queueExists) {
      const embed = new MessageEmbed();
      embed
        .setAuthor('❌ No queue established on the server!')
        .setDescription(
          `If you want to play a song type \`${config.botPrefix}play\` and the name/link of the song in front of it to get the party started! 🥳`
        )
        .setColor(config.errorColor);
      return msg.channel.send({ embed });
    }

    let concatQueueStr = '';
    if (queueExists.songs.length === 1) {
      concatQueueStr =
        'Hmm.. Seems like the queue is empty 🤔\nTry add a song!';
    } else {
      queueExists.songs.forEach((song) => {
        if (queueExists.songs.indexOf(song) === 0) return;
        concatQueueStr += `**${queueExists.songs.indexOf(song)}** — ${
          song.title
        } \`[${song.timestamp}]\`\n`;
      });
    }

    const embed = new MessageEmbed();
    embed
      .setTitle('📃  Music Queue')
      .addField('Currently Listening', `${queueExists.songs[0].title}`, true)
      .addField('Duration', `${queueExists.songs[0].timestamp}`, true)
      .addField('Coming Next', concatQueueStr)
      .setColor(config.mainColor);
    msg.channel.send({ embed });
  }
}
