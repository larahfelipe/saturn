"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleMusicControlsReaction = void 0;
const Play_1 = require("../commands/user/music/Play");
async function handleMusicControlsReaction(bot, msg, playerMsg) {
    let Control;
    (function (Control) {
        Control["PLAY"] = "\u25B6\uFE0F";
        Control["PAUSE"] = "\u23F8";
        Control["STOP"] = "\u23F9\uFE0F";
        Control["SKIP"] = "\u23ED\uFE0F";
    })(Control || (Control = {}));
    await playerMsg
        .react(Control.PAUSE)
        .then(() => playerMsg.react(Control.PLAY))
        .then(() => playerMsg.react(Control.SKIP))
        .then(() => playerMsg.react(Control.STOP));
    const controls = [Control.PLAY, Control.PAUSE, Control.STOP, Control.SKIP];
    const queue = bot.queues.get(msg.guild.id);
    const filter = (reaction, user) => {
        return controls.includes(reaction.emoji.name) && user.id !== bot.user.id;
    };
    const reactionsListener = playerMsg.createReactionCollector(filter);
    reactionsListener.on('collect', (reaction, user) => {
        const getReaction = reaction.emoji.name;
        if (getReaction === Control.PLAY) {
            queue.connection.dispatcher.resume();
            playerMsg.reactions.resolve(Control.PLAY).users.remove(user.id);
        }
        else if (getReaction === Control.PAUSE) {
            queue.connection.dispatcher.pause();
            playerMsg.reactions.resolve(Control.PAUSE).users.remove(user.id);
        }
        else if (getReaction === Control.STOP) {
            queue.connection.disconnect();
        }
        else if (getReaction === Control.SKIP) {
            if (queue.songs.length > 1) {
                queue.songs.shift();
                queue.authors.shift();
                Play_1.setSong(bot, msg, queue.songs[0], queue.authors[0]);
                playerMsg.reactions.resolve(Control.SKIP).users.remove(user.id);
            }
            else
                return;
        }
    });
}
exports.handleMusicControlsReaction = handleMusicControlsReaction;
