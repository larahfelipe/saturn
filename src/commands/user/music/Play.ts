import { Message, MessageEmbed } from 'discord.js';
import axios, { AxiosError, AxiosResponse } from 'axios';
import yts, { SearchResult } from 'yt-search';
import { validateURL, getURLVideoID } from 'ytdl-core';

import config from '../../../config';
import Command from '../../../structs/Command';
import Bot from '../../../structs/Bot';
import SongHandler from '../../../handlers/SongHandler';
import { formatSecondsToTime } from '../../../utils/FormatSecondsToTime';
import { Song, SearchError, IQueue, ISpotifyPlaylist } from '../../../types';

export default class Play extends Command {
  constructor(bot: Bot) {
    super(bot, {
      name: `${config.botPrefix}play`,
      help: 'Plays song from YouTube or Spotify',
      permissionLvl: 0
    });
  }

  async handlePlaySong(song: Song, msg: Message, sendQueueNotifMsg = false) {
    const queue: IQueue = this.bot.queues.get(msg.guild!.id);
    if (!queue) {
      SongHandler.setSong(this.bot, msg, song, msg.author.id);

      const embed = new MessageEmbed();
      embed
        .setTitle('🎵  Music Playback')
        .setDescription(`Joining channel \`${msg.member!.voice.channel!.name}\``)
        .setColor('#6E76E5');
      msg.channel.send({ embed });
    } else {
      queue.songs.push(song);
      queue.authors.push(msg.author.id);
      this.bot.queues.set(msg.guild!.id, queue);

      if (sendQueueNotifMsg) {
        const embed = new MessageEmbed();
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

  async run(msg: Message, args: string[]) {
    if (!args) return msg.reply('You need to give me a song to play it.');

    let requestedSong = args.join(' ');
    let spotifyPlaylistTracks: string[] = [];
    let spotifyPlaylistDuration = 0;
    let song: Song;

    try {
      if (validateURL(requestedSong)) {
        song = await yts({ videoId: getURLVideoID(requestedSong) });
        return this.handlePlaySong(song, msg, true);
      } else if (requestedSong.startsWith('https://open.spotify.com/')) {
        await axios
          .get(requestedSong)
          .then(({ data }: AxiosResponse<string>) => {
            let contextSelector: string;
            if (requestedSong.charAt(25) === 't') {
              contextSelector = data.substring(data.indexOf('<ti') + 7, data.indexOf('|') - 1);
              requestedSong = contextSelector;

            } else if (requestedSong.charAt(25) === 'p') {
              contextSelector = data.substring(data.indexOf('Spotify.Entity') + 17, data.indexOf('"available_markets"') - 1) + '}';
              const spotifyPlaylist: ISpotifyPlaylist = JSON.parse(contextSelector);
              spotifyPlaylistTracks = spotifyPlaylist.tracks.items.map(song => {
                spotifyPlaylistDuration += song.track.duration_ms;
                return `${song.track.name} - ${song.track.album.artists[0].name}`;
              });

              const embed = new MessageEmbed();
              embed
                .setAuthor(`"${spotifyPlaylist.name}"\nSpotify playlist by ${spotifyPlaylist.owner.display_name}`)
                .setDescription(`\n• Total playlist tracks: \`${spotifyPlaylist.tracks.items.length}\`\n• Playlist duration: \`${formatSecondsToTime(spotifyPlaylistDuration / 1000)}\``)
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
            } else throw new Error('Invalid URL');
          })
          .catch((err: AxiosError) => console.error(err));
      }

      if (spotifyPlaylistTracks.length > 0) {
        const playlistTracks = await Promise.all(
          spotifyPlaylistTracks.map(async track => {
            let res: SearchResult = await yts(track);
            if (res && res.videos.length > 0) {
              return res.videos[0];
            }
          })
        );
        song = <Song>playlistTracks[0];
        this.handlePlaySong(song, msg);
        playlistTracks.shift();

        setTimeout(() => {
          playlistTracks.forEach(track => {
            song = <Song>track;
            this.handlePlaySong(song, msg);
          });
        }, 5000);
      } else {
        yts(requestedSong, (err: SearchError, res: SearchResult) => {
          if (err) throw err;
          if (res && res.videos.length > 0) {
            song = res.videos[0];
            this.handlePlaySong(song, msg, true);
          } else return msg.reply('Sorry!, I couldn\'t find any song related to your search.');
        });
      }
    } catch (err) {
      console.error(err);
    }
  }
}
