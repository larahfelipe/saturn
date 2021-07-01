"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const ytdl_core_1 = __importDefault(require("ytdl-core"));
const Song_1 = __importDefault(require("../structs/Song"));
const ReactionHandler_1 = __importDefault(require("./ReactionHandler"));
const DropBotQueueConnection_1 = require("../utils/DropBotQueueConnection");
class SongHandler extends Song_1.default {
    constructor(bot, msg) {
        super(bot, msg);
    }
    async setSong(song, requestAuthor) {
        let queue = this.bot.queues.get(this.msg.guild.id);
        if (!song) {
            if (queue) {
                queue.connection.disconnect();
                return this.bot.queues.delete(this.msg.guild.id);
            }
        }
        if (!this.msg.member?.voice.channel)
            return this.msg.reply('You need to be in a voice channel to play a song.');
        if (!queue) {
            const botConnection = await this.msg.member.voice.channel.join();
            queue = {
                connection: botConnection,
                songs: [song],
                authors: [requestAuthor],
                volume: 10,
                dispatcher: null
            };
        }
        try {
            queue.dispatcher = queue.connection.play(ytdl_core_1.default(song.url, {
                filter: 'audioonly',
                quality: 'highestaudio'
            }));
            const embed = new discord_js_1.MessageEmbed();
            embed
                .setAuthor('We hear you 💜', 'https://raw.githubusercontent.com/felpshn/saturn-bot/master/assets/cd.gif')
                .setThumbnail(song.thumbnail)
                .setDescription(`Now playing **[${song.title}](${song.url})** requested by <@${queue.authors[0]}>`)
                .setFooter(`Song duration: ${song.timestamp}`)
                .setColor('#6E76E5');
            this.msg.channel.send({ embed })
                .then((sentMsg) => {
                ReactionHandler_1.default.resolveMusicControls(this.bot, this.msg, sentMsg);
            });
            queue.dispatcher.on('finish', () => {
                queue.songs.shift();
                queue.authors.shift();
                ReactionHandler_1.default.performDeletion(true);
                new SongHandler(this.bot, this.msg).setSong(queue.songs[0], queue.authors[0]);
            });
            this.bot.queues.set(this.msg.guild.id, queue);
        }
        catch (err) {
            DropBotQueueConnection_1.dropBotQueueConnection(this.bot, this.msg);
            console.error(err);
        }
    }
}
exports.default = SongHandler;
