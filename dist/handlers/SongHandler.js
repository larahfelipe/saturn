"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const ytdl_core_1 = __importDefault(require("ytdl-core"));
const ReactionHandler_1 = __importDefault(require("./ReactionHandler"));
const DropBotQueueConnection_1 = require("../utils/DropBotQueueConnection");
class SongHandler {
    static async setSong(bot, msg, song, requestAuthor) {
        let queue = bot.queues.get(msg.guild.id);
        if (!song) {
            if (queue) {
                queue.connection.disconnect();
                return bot.queues.delete(msg.guild.id);
            }
        }
        if (!msg.member?.voice.channel)
            return msg.reply('You need to be in a voice channel to play a song.');
        if (!queue) {
            const botConnection = await msg.member.voice.channel.join();
            queue = {
                connection: botConnection,
                songs: [song],
                authors: [requestAuthor],
                volume: 10,
                dispatcher: null,
            };
        }
        try {
            queue.dispatcher = queue.connection.play(ytdl_core_1.default(song.url, {
                filter: 'audioonly',
                quality: 'highestaudio',
            }));
            const embed = new discord_js_1.MessageEmbed();
            embed
                .setAuthor('We hear you 💜', 'https://raw.githubusercontent.com/felpshn/saturn-bot/master/src/assets/cd.gif')
                .setThumbnail(song.thumbnail)
                .setDescription(`Now playing **[${song.title}](${song.url})** requested by <@${queue.authors[0]}>`)
                .setFooter(`Song duration: ${song.timestamp}`)
                .setColor('#6E76E5');
            msg.channel.send({ embed }).then((sentMsg) => {
                ReactionHandler_1.default.resolveMusicControls(bot, msg, sentMsg);
            });
            queue.dispatcher.on('finish', () => {
                queue.songs.shift();
                queue.authors.shift();
                ReactionHandler_1.default.performDeletion(true);
                SongHandler.setSong(bot, msg, queue.songs[0], queue.authors[0]);
            });
            bot.queues.set(msg.guild.id, queue);
        }
        catch (err) {
            DropBotQueueConnection_1.dropBotQueueConnection(bot, msg);
            console.error(err);
        }
    }
}
exports.default = SongHandler;
