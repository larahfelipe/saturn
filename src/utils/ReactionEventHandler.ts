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

async function handleMusicControlsReaction (bot: Bot, msg: Message, playerMsg: Message) {
  enum Control {
    PLAY = '▶️',
    PAUSE = '⏸',
    STOP = '⏹️',
    SKIP = '⏭️'
  }

  await playerMsg
    .react(Control.PAUSE)
    .then(() => playerMsg.react(Control.PLAY))
    .then(() => playerMsg.react(Control.SKIP))
    .then(() => playerMsg.react(Control.STOP));

  const controls: string[] = [Control.PLAY, Control.PAUSE, Control.STOP, Control.SKIP];
  const queue: IQueue = bot.queues.get(msg.guild!.id);

  const filter = (reaction: IReaction, user: IUser) => {
    return controls.includes(reaction.emoji.name) && user.id !== bot.user!.id;
  };
  const reactionsListener = playerMsg.createReactionCollector(filter);

  reactionsListener.on('collect', (reaction: IReaction, user: IUser) => {
    const getReaction = reaction.emoji.name;

    if (getReaction === Control.PLAY) {
      queue.connection.dispatcher.resume();
      playerMsg.reactions.resolve(Control.PLAY)!.users.remove(user.id);
    } else if (getReaction === Control.PAUSE) {
      queue.connection.dispatcher.pause();
      playerMsg.reactions.resolve(Control.PAUSE)!.users.remove(user.id);
    } else if (getReaction === Control.STOP) {
      queue.connection.disconnect();
    } else if (getReaction === Control.SKIP) {
      if (queue.songs.length > 1) {
        queue.songs.shift();
        queue.authors.shift();
        setSong(bot, msg, queue.songs[0], queue.authors[0]);
        playerMsg.reactions.resolve(Control.SKIP)!.users.remove(user.id);
      } else return;
    }
  });
}

export { handleMusicControlsReaction };
