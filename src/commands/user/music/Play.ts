import axios, { AxiosResponse } from 'axios';
import { Message, MessageEmbed } from 'discord.js';

import config from '@/config';
import {
  AppMainColor,
  DefaultSpotifyPlaylistObj,
  SpotifyIconUrl,
  YouTubeBaseUrl,
  SpotifyBaseUrl,
  SpotifyColor,
  AppWarningColor
} from '@/constants';
import { PlaybackHandler } from '@/handlers';
import { api } from '@/services';
import { Command, Bot } from '@/structs';
import { Song, SpotifyPlaylist } from '@/types';
import { parseSpotifyRequest, formatSecondsToTime } from '@/utils';

export default class Play extends Command {
  constructor(bot: Bot) {
    super(bot, {
      name: `${config.botPrefix}play`,
      help: 'Plays song from YouTube or Spotify',
      requiredRoleLvl: 0
    });
  }

  async handleMusicPlayback(
    song: Song,
    msg: Message,
    shouldSendQueueNotificationMsg = false
  ) {
    const queue = this.bot.queues.get(msg.guild!.id);
    if (!queue) {
      const playbackHandler = PlaybackHandler.getInstance(this.bot, msg);
      playbackHandler.setSong(song, msg.author.id);

      const embed = new MessageEmbed();
      embed
        .setTitle('🎵  Music Playback')
        .setDescription(
          `Joining channel \`${msg.member!.voice.channel!.name}\``
        )
        .setColor(AppMainColor);
      msg.channel.send({ embed });
    } else {
      queue.songs.push(song);
      queue.authors.push(msg.author.id);
      this.bot.queues.set(msg.guild!.id, queue);

      if (shouldSendQueueNotificationMsg) {
        const embed = new MessageEmbed();
        embed
          .setTitle('📃  Queue')
          .setDescription(
            `Got it! [${song.title}](${
              song.videoUrl
            }) was added to the queue and his current position is \`${queue.songs.indexOf(
              song
            )}\`.\n\nYou can see the guild's queue anytime using \`${
              config.botPrefix
            }queue\``
          )
          .setFooter(
            `Added by ${msg.author.username}`,
            msg.author.displayAvatarURL()
          )
          .setTimestamp(Date.now())
          .setColor(AppMainColor);
        msg.channel.send({ embed });
      }
    }
  }

  async run(msg: Message, args: string[]) {
    if (!args) return msg.reply('You need to give me a song to play it.');

    let requestedSong = args.join(' ');
    let spotifyPlaylist = DefaultSpotifyPlaylistObj as SpotifyPlaylist;
    let song: Song;

    try {
      if (requestedSong.includes(YouTubeBaseUrl)) {
        const { data }: AxiosResponse<Song> = await api.get(
          `/track?title=${requestedSong}`
        );
        song = data;
        return this.handleMusicPlayback(song, msg, true);
      } else if (requestedSong.includes(SpotifyBaseUrl)) {
        const { data }: AxiosResponse<string> = await axios.get(requestedSong);

        if (requestedSong.includes('track')) {
          requestedSong = parseSpotifyRequest('TRACK', data) as string;
        } else if (requestedSong.includes('playlist')) {
          spotifyPlaylist = parseSpotifyRequest(
            'PLAYLIST',
            data
          ) as SpotifyPlaylist;

          const embed = new MessageEmbed();
          embed
            .setAuthor(
              `"${spotifyPlaylist.name}"\nSpotify playlist by ${spotifyPlaylist.owner}`
            )
            .setDescription(
              `\n• Total playlist tracks: \`${
                spotifyPlaylist.tracks.length
              }\`\n• Playlist duration: \`${formatSecondsToTime(
                spotifyPlaylist.duration / 1000
              )}\``
            )
            .setThumbnail(spotifyPlaylist.cover)
            .setFooter('Spotify | Music for everyone', SpotifyIconUrl)
            .setColor(SpotifyColor);
          msg.channel.send({ embed });

          embed
            .setAuthor('Gotcha!, loading playlist songs ... ⏳')
            .setDescription("I'll join the party in a moment, please wait")
            .setThumbnail('')
            .setFooter('')
            .setColor(AppWarningColor);
          msg.channel.send({ embed });
        } else throw new Error('An invalid Spotify URL was provided.');
      }

      if (spotifyPlaylist.tracks.length > 0) {
        const playlistTracks = await Promise.all(
          spotifyPlaylist.tracks.map(async (track) => {
            const { data }: AxiosResponse<Song> = await api.get(
              `/track?title=${track}`
            );
            return data;
          })
        );
        song = playlistTracks[0] as Song;
        this.handleMusicPlayback(song, msg);
        playlistTracks.shift();

        setTimeout(() => {
          playlistTracks.forEach((track) => {
            song = track as Song;
            this.handleMusicPlayback(song, msg);
          });
        }, 2500);
      } else {
        const { data }: AxiosResponse<Song> = await api.get(
          `/track?title=${requestedSong}`
        );
        song = data;
        this.handleMusicPlayback(song, msg, true);
      }
    } catch (err) {
      this.bot.logger.emitErrorReport(err);
    }
  }
}
