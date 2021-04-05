"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Reaction = void 0;
const Play_1 = require("../commands/user/music/Play");
var Control;
(function (Control) {
    Control["PLAY"] = "\u25B6\uFE0F";
    Control["PAUSE"] = "\u23F8";
    Control["STOP"] = "\u23F9\uFE0F";
    Control["SKIP"] = "\u23ED\uFE0F";
})(Control || (Control = {}));
class Reaction {
    static async handleDeletion(bulkDelete, targetReaction, userID) {
        if (bulkDelete) {
            this.controls.forEach(async (currControl) => {
                await this.playerMsg.reactions.resolve(currControl).users.remove();
            });
        }
        else {
            switch (targetReaction) {
                case Control.PLAY:
                    this.playerMsg.reactions.resolve(Control.PLAY).users.remove(userID);
                    break;
                case Control.PAUSE:
                    this.playerMsg.reactions.resolve(Control.PAUSE).users.remove(userID);
                    break;
                case Control.SKIP:
                    this.playerMsg.reactions.resolve(Control.SKIP).users.remove(userID);
                    break;
                default:
                    throw new Error('Unexpected case!');
            }
        }
    }
    static async handleMusicControls(bot, msg, sentMsg) {
        this.playerMsg = sentMsg;
        this.controls.forEach(async (currControl) => {
            await this.playerMsg.react(currControl);
        });
        const queue = bot.queues.get(msg.guild.id);
        const filter = (reaction, user) => {
            return this.controls.includes(reaction.emoji.name) && user.id !== bot.user.id;
        };
        const reactionsListener = this.playerMsg.createReactionCollector(filter);
        reactionsListener.on('collect', (reaction, user) => {
            const getReaction = reaction.emoji.name;
            if (getReaction === Control.PLAY) {
                queue.connection.dispatcher.resume();
                this.handleDeletion(false, Control.PLAY, user.id);
            }
            else if (getReaction === Control.PAUSE) {
                queue.connection.dispatcher.pause();
                this.handleDeletion(false, Control.PAUSE, user.id);
            }
            else if (getReaction === Control.STOP) {
                queue.connection.disconnect();
                bot.queues.delete(msg.guild.id);
            }
            else if (getReaction === Control.SKIP) {
                if (queue.songs.length > 1) {
                    queue.songs.shift();
                    queue.authors.shift();
                    this.handleDeletion(false, Control.SKIP, user.id);
                    Play_1.setSong(bot, msg, queue.songs[0], queue.authors[0]);
                }
                else
                    return;
            }
        });
    }
}
exports.Reaction = Reaction;
Reaction.controls = [Control.PAUSE, Control.PLAY, Control.SKIP, Control.STOP];
