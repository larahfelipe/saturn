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
    play = '▶️',
    pause = '⏸',
    stop = '⏹️',
    skip = '⏭️'
  }

  await playerMsg
    .react(Control.pause)
    .then(() => playerMsg.react(Control.play))
    .then(() => playerMsg.react(Control.skip))
    .then(() => playerMsg.react(Control.stop));

  const controls: string[] = [Control.play, Control.pause, Control.stop, Control.skip];
  const queue: IQueue = bot.queues.get(msg.guild!.id);

  const filter = (reaction: IReaction, user: IUser) => {
    return controls.includes(reaction.emoji.name) && user.id === msg.author.id;
  };
  const reactionsListener = playerMsg.createReactionCollector(filter, { time: queue.songs[0].seconds * 1000 });

  reactionsListener.on('collect', (reaction: IReaction, user: IUser) => {
    const getReaction = reaction.emoji.name;

    if (getReaction === Control.play) {
      queue.connection.dispatcher.resume();
      playerMsg.reactions.resolve(Control.play)!.users.remove(user.id);
    } else if (getReaction === Control.pause) {
      queue.connection.dispatcher.pause();
      playerMsg.reactions.resolve(Control.pause)!.users.remove(user.id);
    } else if (getReaction === Control.stop) {
      queue.connection.disconnect();
    } else if (getReaction === Control.skip) {
      if (queue.songs.length > 1) {
        queue.songs.shift();
        queue.authors.shift();
        setSong(bot, msg, queue.songs[0], queue.authors[0]);
        playerMsg.reactions.resolve(Control.skip)!.users.remove(user.id);
      } else return;
    }
  });
}

export { handleMusicControlsReaction };
