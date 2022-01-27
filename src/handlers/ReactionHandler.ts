import { Message, UserResolvable } from 'discord.js';

import { Control } from '@/constants';
import { PlaybackHandler } from '@/handlers';
import { Bot } from '@/structs';
import { IReaction, User, Song } from '@/types';

export class ReactionHandler {
  private static MessageWithReaction: Message;

  static async deleteAsync(
    targetReaction: string | string[],
    targetUserId?: UserResolvable
  ) {
    if (Array.isArray(targetReaction)) {
      targetReaction.forEach(async (reaction: string) => {
        try {
          await this.MessageWithReaction.reactions
            .resolve(reaction)
            ?.users.remove();
        } catch (err) {
          console.error(err);
        }
      });
    } else
      await this.MessageWithReaction.reactions
        .resolve(targetReaction)
        ?.users.remove(targetUserId);
  }

  static async resolvePlaybackControls(
    playerMsg: Message,
    bot: Bot,
    msg: Message
  ) {
    try {
      this.MessageWithReaction = playerMsg;
      PlaybackHandler.musicControls.forEach(
        async (control) => await this.MessageWithReaction.react(control)
      );

      const queue = bot.queues.get(msg.guild!.id);
      if (!queue) return;

      const filter = (reaction: IReaction, user: User) =>
        PlaybackHandler.musicControls.includes(reaction.emoji.name) &&
        user.id !== bot.user!.id;

      const reactionsListener =
        this.MessageWithReaction.createReactionCollector(filter);

      reactionsListener.on('collect', (reaction: IReaction, user: User) => {
        const collectedReaction = reaction.emoji.name;

        switch (collectedReaction) {
          case Control.PLAY:
            queue.connection.dispatcher.resume();
            this.deleteAsync(Control.PLAY, user.id);
            break;
          case Control.PAUSE:
            queue.connection.dispatcher.pause();
            this.deleteAsync(Control.PAUSE, user.id);
            break;
          case Control.STOP:
            queue.connection.disconnect();
            bot.queues.delete(msg.guild!.id);
            setTimeout(() => {
              this.deleteAsync(PlaybackHandler.musicControls);
            }, 3000);
            break;
          case Control.SKIP:
            if (queue.songs && queue.songs.length > 1) {
              queue.songs.shift();
              queue.authors.shift();
              this.deleteAsync(PlaybackHandler.musicControls);

              const playbackHandler = PlaybackHandler.getInstance(bot, msg);
              playbackHandler.setSong(queue.songs[0] as Song, queue.authors[0]);
              break;
            } else return;
          default:
            throw new RangeError('Unexpected case.');
        }
      });
    } catch (err) {
      bot.logger.emitErrorReport(err);
    }
  }
}
