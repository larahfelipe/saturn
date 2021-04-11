"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setSong = void 0;
const axios_1 = __importDefault(require("axios"));
const yt_search_1 = __importDefault(require("yt-search"));
const ytdl_core_1 = __importDefault(require("ytdl-core"));
const discord_js_1 = require("discord.js");
const ReactionsHandler_1 = require("../../../utils/ReactionsHandler");
const DropBotQueueConnection_1 = require("../../../utils/DropBotQueueConnection");
async function run(bot, msg, args) {
    let querySong = args.join(' ');
    let song;
    try {
        if (ytdl_core_1.default.validateURL(querySong)) {
            song = await yt_search_1.default({ videoId: ytdl_core_1.default.getURLVideoID(querySong) });
            handlePlaySong();
        }
        else {
            if (querySong.startsWith('https://open.spotify.com/track/')) {
                await axios_1.default
                    .get(querySong)
                    .then(({ data }) => {
                    const htmlData = data;
                    querySong = htmlData.substring(htmlData.indexOf('<ti') + 7, htmlData.indexOf('|') - 1);
                })
                    .catch((err) => {
                    console.log('Error search');
                    throw err;
                });
            }
            yt_search_1.default(querySong, (err, res) => {
                if (err)
                    return console.error(err);
                if (res && res.videos.length > 0) {
                    song = res.videos[0];
                    handlePlaySong();
                }
                else
                    return msg.reply('Sorry!, I couldn\'t find any song related to your search.');
            });
        }
    }
    catch (err) {
        console.error(err);
        msg.reply('You need to give me a song in order to play it!');
    }
    function handlePlaySong() {
        const queueExists = bot.queues.get(msg.guild.id);
        if (!queueExists) {
            setSong(bot, msg, song, msg.author.id);
            const embed = new discord_js_1.MessageEmbed();
            embed
                .setTitle('🎵  Music Playback')
                .setDescription(`Joining channel \`${msg.member.voice.channel.name}\``)
                .setColor('#6E76E5');
            msg.channel.send({ embed });
        }
        else {
            queueExists.songs.push(song);
            queueExists.authors.push(msg.author.id);
            bot.queues.set(msg.guild.id, queueExists);
            const embed = new discord_js_1.MessageEmbed();
            embed
                .setTitle('📃  Queue')
                .setDescription(`Got it! [${song.title}](${song.url}) was added to the queue and his current position is \`${queueExists.songs.indexOf(song)}\`.\n\nYou can see the guild's queue anytime using \`.queue\``)
                .setFooter(`Added by ${msg.author.username}`, msg.author.displayAvatarURL())
                .setTimestamp(new Date())
                .setColor('#6E76E5');
            msg.channel.send({ embed });
        }
    }
}
async function setSong(bot, msg, song, msgAuthor) {
    var _a;
    let queue = bot.queues.get(msg.guild.id);
    if (!song) {
        if (queue) {
            queue.connection.disconnect();
            return bot.queues.delete(msg.guild.id);
        }
    }
    if (!((_a = msg.member) === null || _a === void 0 ? void 0 : _a.voice.channel))
        return msg.reply('You need to be in a voice channel in order to play a song!');
    if (!queue) {
        const botConnection = await msg.member.voice.channel.join();
        queue = {
            connection: botConnection,
            songs: [song],
            authors: [msgAuthor],
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
        msg.channel.send({ embed })
            .then((sentMsg) => { ReactionsHandler_1.Reaction.handleMusicControls(bot, msg, sentMsg); });
        queue.dispatcher.on('finish', () => {
            queue.songs.shift();
            queue.authors.shift();
            ReactionsHandler_1.Reaction.handleDeletion(true);
            setSong(bot, msg, queue.songs[0], queue.authors[0]);
        });
        bot.queues.set(msg.guild.id, queue);
    }
    catch (err) {
        DropBotQueueConnection_1.dropBotQueueConnection(bot, msg);
        console.error(err);
    }
}
exports.setSong = setSong;
exports.default = {
    name: `${process.env.BOT_PREFIX}play`,
    help: 'Plays song from YouTube or Spotify',
    permissionLvl: 0,
    run
};
