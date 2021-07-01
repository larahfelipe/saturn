"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const SongHandler_1 = __importDefault(require("./SongHandler"));
var Control;
(function (Control) {
    Control["PLAY"] = "\u25B6\uFE0F";
    Control["PAUSE"] = "\u23F8";
    Control["STOP"] = "\u23F9\uFE0F";
    Control["SKIP"] = "\u23ED\uFE0F";
})(Control || (Control = {}));
class ReactionHandler {
    static async performDeletion(bulkDelete, targetReaction, userID) {
        try {
            if (bulkDelete) {
                this.musicControls.forEach(async (control) => {
                    await this.playerMsg.reactions.resolve(control).users.remove();
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
                        throw new RangeError('Unexpected case.');
                }
            }
        }
        catch (err) {
            console.error(err);
        }
    }
    static async resolveMusicControls(bot, msg, sentMsg) {
        try {
            this.playerMsg = sentMsg;
            this.musicControls.forEach(async (control) => {
                await this.playerMsg.react(control);
            });
            const queue = bot.queues.get(msg.guild.id);
            const filter = (reaction, user) => {
                return this.musicControls.includes(reaction.emoji.name) && user.id !== bot.user.id;
            };
            const reactionsListener = this.playerMsg.createReactionCollector(filter);
            reactionsListener.on('collect', (reaction, user) => {
                const getReaction = reaction.emoji.name;
                if (getReaction === Control.PLAY) {
                    queue.connection.dispatcher.resume();
                    this.performDeletion(false, Control.PLAY, user.id);
                }
                else if (getReaction === Control.PAUSE) {
                    queue.connection.dispatcher.pause();
                    this.performDeletion(false, Control.PAUSE, user.id);
                }
                else if (getReaction === Control.STOP) {
                    queue.connection.disconnect();
                    bot.queues.delete(msg.guild.id);
                    setTimeout(() => {
                        this.performDeletion(true);
                    }, 5000);
                }
                else if (getReaction === Control.SKIP) {
                    if (queue.songs.length > 1) {
                        queue.songs.shift();
                        queue.authors.shift();
                        this.performDeletion(true);
                        new SongHandler_1.default(bot, msg).setSong(queue.songs[0], queue.authors[0]);
                    }
                    else
                        return;
                }
            });
        }
        catch (err) {
            console.error(err);
        }
    }
}
ReactionHandler.musicControls = [Control.PAUSE, Control.PLAY, Control.SKIP, Control.STOP];
exports.default = ReactionHandler;
