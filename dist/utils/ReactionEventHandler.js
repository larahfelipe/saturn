"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleMusicControlsReaction = void 0;
const Play_1 = require("../commands/user/music/Play");
async function handleMusicControlsReaction(bot, msg, playerMsg) {
    let Control;
    (function (Control) {
        Control["play"] = "\u25B6\uFE0F";
        Control["pause"] = "\u23F8";
        Control["stop"] = "\u23F9\uFE0F";
        Control["skip"] = "\u23ED\uFE0F";
    })(Control || (Control = {}));
    await playerMsg
        .react(Control.pause)
        .then(() => playerMsg.react(Control.play))
        .then(() => playerMsg.react(Control.skip))
        .then(() => playerMsg.react(Control.stop));
    const controls = [Control.play, Control.pause, Control.stop, Control.skip];
    const queue = bot.queues.get(msg.guild.id);
    const filter = (reaction, user) => {
        return controls.includes(reaction.emoji.name) && user.id === msg.author.id;
    };
    const reactionsListener = playerMsg.createReactionCollector(filter, { time: queue.songs[0].seconds * 1000 });
    reactionsListener.on('collect', (reaction, user) => {
        const getReaction = reaction.emoji.name;
        if (getReaction === Control.play) {
            queue.connection.dispatcher.resume();
            playerMsg.reactions.resolve(Control.play).users.remove(user.id);
        }
        else if (getReaction === Control.pause) {
            queue.connection.dispatcher.pause();
            playerMsg.reactions.resolve(Control.pause).users.remove(user.id);
        }
        else if (getReaction === Control.stop) {
            queue.connection.disconnect();
        }
        else if (getReaction === Control.skip) {
            if (queue.songs.length > 1) {
                queue.songs.shift();
                queue.authors.shift();
                Play_1.setSong(bot, msg, queue.songs[0], queue.authors[0]);
                playerMsg.reactions.resolve(Control.skip).users.remove(user.id);
            }
            else
                return;
        }
    });
}
exports.handleMusicControlsReaction = handleMusicControlsReaction;
