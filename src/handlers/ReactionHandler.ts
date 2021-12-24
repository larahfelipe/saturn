import { Message } from 'discord.js';

import Bot from '@/structs/Bot';
import { IReaction, IUser, Song } from '@/types';

import SongHandler from './SongHandler';

enum Control {
  PLAY = '▶️',
  PAUSE = '⏸',
  STOP = '⏹️',
  SKIP = '⏭️'
}

class ReactionHandler {
  private static musicControls: string[] = [
    Control.PAUSE,
    Control.PLAY,
    Control.SKIP,
    Control.STOP
  ];
  private static playerMsg: Message;

  static async performDeletion(
    bulkDelete: boolean,
    targetReaction?: Control | string,
    userId?: any
  ) {
    try {
      if (bulkDelete) {
        this.musicControls.forEach(async (control) => {
          await this.playerMsg.reactions.resolve(control)!.users.remove();
        });
      } else {
        switch (targetReaction) {
          case Control.PLAY:
            this.playerMsg.reactions
              .resolve(Control.PLAY)!
              .users.remove(userId);
            break;
          case Control.PAUSE:
            this.playerMsg.reactions
              .resolve(Control.PAUSE)!
              .users.remove(userId);
            break;
          case Control.SKIP:
            this.playerMsg.reactions
              .resolve(Control.SKIP)!
              .users.remove(userId);
            break;
          default:
            throw new RangeError('Unexpected case.');
        }
      }
    } catch (err) {
      console.error(err);
    }
  }

  static async resolveMusicControls(bot: Bot, msg: Message, sentMsg: Message) {
    try {
      this.playerMsg = sentMsg;
      this.musicControls.forEach(async (control) => {
        await this.playerMsg.react(control);
      });

      const queue = bot.queues.get(msg.guild!.id);
      if (!queue) return;

      const filter = (reaction: IReaction, user: IUser) => {
        return (
          this.musicControls.includes(reaction.emoji.name) &&
          user.id !== bot.user!.id
        );
      };
      const reactionsListener = this.playerMsg.createReactionCollector(filter);

      reactionsListener.on('collect', (reaction: IReaction, user: IUser) => {
        const getReaction = reaction.emoji.name;

        switch (getReaction) {
          case Control.PLAY:
            queue.connection.dispatcher.resume();
            this.performDeletion(false, Control.PLAY, user.id);
            break;
          case Control.PAUSE:
            queue.connection.dispatcher.pause();
            this.performDeletion(false, Control.PAUSE, user.id);
            break;
          case Control.STOP:
            queue.connection.disconnect();
            bot.queues.delete(msg.guild!.id);
            setTimeout(() => {
              this.performDeletion(true);
            }, 3000);
            break;
          case Control.SKIP:
            if (queue.songs && queue.songs.length > 1) {
              queue.songs.shift();
              queue.authors.shift();
              this.performDeletion(true);

              SongHandler.setSong(
                bot,
                msg,
                queue.songs[0] as Song,
                queue.authors[0]
              );
              break;
            } else return;
          default:
            throw new RangeError('Unexpected case.');
        }
      });
    } catch (err) {
      console.error(err);
    }
  }
}

export default ReactionHandler;
