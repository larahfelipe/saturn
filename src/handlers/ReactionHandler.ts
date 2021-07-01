import { Message } from 'discord.js';

import Bot from '../structs/Bot';
import SongHandler from './SongHandler';
import { IReaction, IUser, IQueue } from '../types';

enum Control {
  PLAY = '▶️',
  PAUSE = '⏸',
  STOP = '⏹️',
  SKIP = '⏭️'
}

class ReactionHandler {
  private static musicControls: string[] = [Control.PAUSE, Control.PLAY, Control.SKIP, Control.STOP];
  private static playerMsg: Message;

  static async performDeletion(bulkDelete: boolean, targetReaction?: Control | string, userID?: IUser | any) {
    try {
      if (bulkDelete) {
        this.musicControls.forEach(async control => {
          await this.playerMsg.reactions.resolve(control)!.users.remove();
        });
      } else {
        switch (targetReaction) {
          case Control.PLAY:
            this.playerMsg.reactions.resolve(Control.PLAY)!.users.remove(userID);
            break;
          case Control.PAUSE:
            this.playerMsg.reactions.resolve(Control.PAUSE)!.users.remove(userID);
            break;
          case Control.SKIP:
            this.playerMsg.reactions.resolve(Control.SKIP)!.users.remove(userID);
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
      this.musicControls.forEach(async control => {
        await this.playerMsg.react(control);
      });

      const queue: IQueue = bot.queues.get(msg.guild!.id);

      const filter = (reaction: IReaction, user: IUser) => {
        return this.musicControls.includes(reaction.emoji.name) && user.id !== bot.user!.id;
      };
      const reactionsListener = this.playerMsg.createReactionCollector(filter);

      reactionsListener.on('collect', (reaction: IReaction, user: IUser) => {
        const getReaction = reaction.emoji.name;

        if (getReaction === Control.PLAY) {
          queue.connection.dispatcher.resume();
          this.performDeletion(false, Control.PLAY, user.id);
        } else if (getReaction === Control.PAUSE) {
          queue.connection.dispatcher.pause();
          this.performDeletion(false, Control.PAUSE, user.id);
        } else if (getReaction === Control.STOP) {
          queue.connection.disconnect();
          bot.queues.delete(msg.guild!.id);
          setTimeout(() => {
            this.performDeletion(true);
          }, 5000);
        } else if (getReaction === Control.SKIP) {
          if (queue.songs.length > 1) {
            queue.songs.shift();
            queue.authors.shift();
            this.performDeletion(true);

            new SongHandler(bot, msg).setSong(queue.songs[0], queue.authors[0]);
          } else return;
        }
      });
    } catch (err) {
      console.error(err);
    }
  }
}

export default ReactionHandler;
