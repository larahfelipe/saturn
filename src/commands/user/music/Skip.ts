import { Message, MessageEmbed } from 'discord.js';

import config from '@/config';
import { AppMainColor } from '@/constants';
import { ReactionHandler, PlaybackHandler } from '@/handlers';
import { Command, Bot } from '@/structs';
import { Song } from '@/types';

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
      ReactionHandler.deleteAsync(PlaybackHandler.musicControls);

      const embed = new MessageEmbed();
      embed
        .setTitle('⏭  Skip Music')
        .setDescription('Okay! Setting up the next song for you.')
        .setColor(AppMainColor);
      msg.channel.send({ embed });

      const playbackHandler = PlaybackHandler.getInstance(this.bot, msg);
      playbackHandler.setSong(
        queueExists.songs[0] as Song,
        queueExists.authors[0]
      );
    }
  }
}
