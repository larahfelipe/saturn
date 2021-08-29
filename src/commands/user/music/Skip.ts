import { Message, MessageEmbed } from 'discord.js';

import config from '@/config';
import Command from '@/structs/Command';
import Bot from '@/structs/Bot';
import ReactionHandler from '@/handlers/ReactionHandler';
import SongHandler from '@/handlers/SongHandler';

export default class Skip extends Command {
  constructor(bot: Bot) {
    super(bot, {
      name: `${config.botPrefix}skip`,
      help: 'Skip the current song',
      requiredRoleLvl: 0
    });
  }

  async run(msg: Message) {
    const queueExists = this.bot.queues.get(msg.guild!.id);
    if (!queueExists) return msg.reply("There's no song currently playing.");

    if (queueExists.songs.length > 1) {
      queueExists.songs.shift();
      queueExists.authors.shift();
      ReactionHandler.performDeletion(true);

      const embed = new MessageEmbed();
      embed
        .setTitle('⏭  Skip Music')
        .setDescription('Okay! Setting up the next song for you.')
        .setColor(config.mainColor);
      msg.channel.send({ embed });

      SongHandler.setSong(
        this.bot,
        msg,
        queueExists.songs[0],
        queueExists.authors[0]
      );
    }
  }
}
