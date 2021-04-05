import { Message, ReactionCollector } from 'discord.js';
import { Bot } from '..';

import { setSong, IQueue } from '../commands/user/music/Play';

interface IReaction extends ReactionCollector {
  emoji: {
    name: string;
  }
}

interface IUser {
  id: string;
}

enum Control {
  PLAY = '▶️',
  PAUSE = '⏸',
  STOP = '⏹️',
  SKIP = '⏭️'
}

export class Reaction {
  private static controls: string[] = [Control.PAUSE, Control.PLAY, Control.SKIP, Control.STOP];
  private static playerMsg: Message;

  static async handleDeletion(bulkDelete: boolean, targetReaction?: Control | string, userID?: IUser | any) {
    if (bulkDelete) {
      this.controls.forEach(async (currControl) => {
        await this.playerMsg.reactions.resolve(currControl)!.users.remove();
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
          throw new Error('Unexpected case!');
      }
    }
  }

  static async handleMusicControls(bot: Bot, msg: Message, sentMsg: Message) {
    this.playerMsg = sentMsg;

    this.controls.forEach(async (currControl) => {
      await this.playerMsg.react(currControl);
    });

    const queue: IQueue = bot.queues.get(msg.guild!.id);

    const filter = (reaction: IReaction, user: IUser) => {
      return this.controls.includes(reaction.emoji.name) && user.id !== bot.user!.id;
    };
    const reactionsListener = this.playerMsg.createReactionCollector(filter);

    reactionsListener.on('collect', (reaction: IReaction, user: IUser) => {
      const getReaction = reaction.emoji.name;

      if (getReaction === Control.PLAY) {
        queue.connection.dispatcher.resume();
        this.handleDeletion(false, Control.PLAY, user.id);
      } else if (getReaction === Control.PAUSE) {
        queue.connection.dispatcher.pause();
        this.handleDeletion(false, Control.PAUSE, user.id);
      } else if (getReaction === Control.STOP) {
        queue.connection.disconnect();
        bot.queues.delete(msg.guild!.id);
      } else if (getReaction === Control.SKIP) {
        if (queue.songs.length > 1) {
          queue.songs.shift();
          queue.authors.shift();
          this.handleDeletion(false, Control.SKIP, user.id);
          
          setSong(bot, msg, queue.songs[0], queue.authors[0]);
        } else return;
      }
    });
  }
}
