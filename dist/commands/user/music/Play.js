"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const axios_1 = __importDefault(require("axios"));
const yt_search_1 = __importDefault(require("yt-search"));
const ytdl_core_1 = require("ytdl-core");
const config_1 = __importDefault(require("../../../config"));
const Command_1 = __importDefault(require("../../../structs/Command"));
const SongHandler_1 = __importDefault(require("../../../handlers/SongHandler"));
const FormatSecondsToTime_1 = require("../../../utils/FormatSecondsToTime");
class Play extends Command_1.default {
    constructor(bot) {
        super(bot, {
            name: `${config_1.default.botPrefix}play`,
            help: 'Plays song from YouTube or Spotify',
            permissionLvl: 0
        });
    }
    async handlePlaySong(song, msg, sendQueueNotifMsg = false) {
        const queue = this.bot.queues.get(msg.guild.id);
        if (!queue) {
            new SongHandler_1.default(this.bot, msg).setSong(song, msg.author.id);
            const embed = new discord_js_1.MessageEmbed();
            embed
                .setTitle('🎵  Music Playback')
                .setDescription(`Joining channel \`${msg.member.voice.channel.name}\``)
                .setColor('#6E76E5');
            msg.channel.send({ embed });
        }
        else {
            queue.songs.push(song);
            queue.authors.push(msg.author.id);
            this.bot.queues.set(msg.guild.id, queue);
            if (sendQueueNotifMsg) {
                const embed = new discord_js_1.MessageEmbed();
                embed
                    .setTitle('📃  Queue')
                    .setDescription(`Got it! [${song.title}](${song.url}) was added to the queue and his current position is \`${queue.songs.indexOf(song)}\`.\n\nYou can see the guild's queue anytime using \`${process.env.BOT_PREFIX}queue\``)
                    .setFooter(`Added by ${msg.author.username}`, msg.author.displayAvatarURL())
                    .setTimestamp(new Date())
                    .setColor('#6E76E5');
                msg.channel.send({ embed });
            }
        }
    }
    async run(msg, args) {
        if (!args)
            return msg.reply('You need to give me a song to play it.');
        let requestedSong = args.join(' ');
        let spotifyPlaylistTracks = [];
        let spotifyPlaylistDuration = 0;
        let song;
        try {
            if (ytdl_core_1.validateURL(requestedSong)) {
                song = await yt_search_1.default({ videoId: ytdl_core_1.getURLVideoID(requestedSong) });
                return this.handlePlaySong(song, msg, true);
            }
            else if (requestedSong.startsWith('https://open.spotify.com/')) {
                await axios_1.default
                    .get(requestedSong)
                    .then(({ data }) => {
                    let contextSelector;
                    if (requestedSong.charAt(25) === 't') {
                        contextSelector = data.substring(data.indexOf('<ti') + 7, data.indexOf('|') - 1);
                        requestedSong = contextSelector;
                    }
                    else if (requestedSong.charAt(25) === 'p') {
                        contextSelector = data.substring(data.indexOf('Spotify.Entity') + 17, data.indexOf('"available_markets"') - 1) + '}';
                        const spotifyPlaylist = JSON.parse(contextSelector);
                        spotifyPlaylistTracks = spotifyPlaylist.tracks.items.map(song => {
                            spotifyPlaylistDuration += song.track.duration_ms;
                            return `${song.track.name} - ${song.track.album.artists[0].name}`;
                        });
                        const embed = new discord_js_1.MessageEmbed();
                        embed
                            .setAuthor(`"${spotifyPlaylist.name}"\nSpotify playlist by ${spotifyPlaylist.owner.display_name}`)
                            .setDescription(`\n• Total playlist tracks: \`${spotifyPlaylist.tracks.items.length}\`\n• Playlist duration: \`${FormatSecondsToTime_1.formatSecondsToTime(spotifyPlaylistDuration / 1000)}\``)
                            .setThumbnail(spotifyPlaylist.images[0].url)
                            .setFooter('Spotify | Music for everyone')
                            .setColor('#6E76E5');
                        msg.channel.send({ embed });
                        embed
                            .setAuthor('Gotcha!, loading playlist songs ... ⏳')
                            .setDescription('I\'ll join the party in a moment, please wait')
                            .setThumbnail('')
                            .setFooter('');
                        msg.channel.send({ embed });
                    }
                    else
                        throw new Error('Invalid URL');
                })
                    .catch((err) => console.error(err));
            }
            if (spotifyPlaylistTracks.length > 0) {
                const playlistTracks = await Promise.all(spotifyPlaylistTracks.map(async (track) => {
                    let res = await yt_search_1.default(track);
                    if (res && res.videos.length > 0) {
                        return res.videos[0];
                    }
                }));
                song = playlistTracks[0];
                this.handlePlaySong(song, msg);
                playlistTracks.shift();
                setTimeout(() => {
                    playlistTracks.forEach(track => {
                        song = track;
                        this.handlePlaySong(song, msg);
                    });
                }, 5000);
            }
            else {
                yt_search_1.default(requestedSong, (err, res) => {
                    if (err)
                        throw err;
                    if (res && res.videos.length > 0) {
                        song = res.videos[0];
                        this.handlePlaySong(song, msg, true);
                    }
                    else
                        return msg.reply('Sorry!, I couldn\'t find any song related to your search.');
                });
            }
        }
        catch (err) {
            console.error(err);
        }
    }
}
exports.default = Play;
