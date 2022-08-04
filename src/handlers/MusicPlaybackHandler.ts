import axios, { type AxiosResponse } from 'axios';
import type { Message } from 'discord.js';
import yts, {
  type VideoMetadataResult,
  type VideoSearchResult
} from 'yt-search';
import ytdl, { type downloadOptions as DownloadOptions } from 'ytdl-core';

import {
  APP_LOADING_PLAYLIST_TRACKS_DESCRIPTION,
  APP_LOADING_PLAYLIST_TRACKS_TITLE,
  APP_MAIN_COLOR,
  APP_USER_NOT_IN_VOICE_CHANNEL,
  APP_WARNING_COLOR,
  CD_GIF_URL,
  PLATFORMS,
  SPOTIFY_BASE_URL,
  SPOTIFY_COLOR,
  YOUTUBE_BASE_URL
} from '@/constants';
import { GeneralAppError } from '@/errors/GeneralAppError';
import { InvalidParameterError } from '@/errors/InvalidParameterError';
import type { Bot } from '@/structures/Bot';
import { Embed } from '@/structures/Embed';
import type {
  GetTrackResult,
  SpotifyPlaylist,
  Track,
  TrackData
} from '@/types';
import { formatSecondsToStdTime } from '@/utils/FormatTime';
import { parseSpotifyResponse } from '@/utils/ParseSpotifyResponse';
import { isValidURL } from '@/utils/ValidateURL';

export class MusicPlaybackHandler {
  private static INSTANCE: MusicPlaybackHandler;
  protected bot: Bot;
  protected msg: Message;

  private constructor(bot: Bot, msg: Message) {
    this.bot = bot;
    this.msg = msg;
  }

  static getInstance(bot: Bot, msg: Message) {
    if (
      !this.INSTANCE ||
      this.INSTANCE.msg.guild?.id !== msg.guild?.id ||
      this.INSTANCE.msg.author.id !== msg.author.id
    )
      this.INSTANCE = new MusicPlaybackHandler(bot, msg);
    return this.INSTANCE;
  }

  private async downloadTrack(tracksUri: string[]) {
    if (!tracksUri.length)
      throw new InvalidParameterError('Tracks URI not provided');

    const downloadOptions: DownloadOptions = {
      filter: 'audioonly',
      quality: 'highestaudio',
      highWaterMark: 1 << 25
    };

    const tracksData = await Promise.all(
      tracksUri.map(async (trackUri) => {
        const trackInfo = await this.getTrackInfo(trackUri);
        if (!trackInfo)
          throw new Error(`Couldn't fetch "${trackUri}" data on YouTube`);

        const trackReadableStream = ytdl(trackInfo.url, downloadOptions).on(
          'error',
          (err) => {
            throw err;
          }
        );

        return {
          data: trackInfo,
          readableStream: trackReadableStream
        } as TrackData;
      })
    );

    return tracksData;
  }

  private async setTrack(track: TrackData, requestAuthor: string) {
    let audioPlayer = this.bot.AudioPlayers.get(this.msg.guild!.id);

    if (!Object.keys(track).length && audioPlayer) {
      audioPlayer.state.disconnect();
      this.bot.AudioPlayers.delete(this.msg.guild!.id);
    }

    if (!this.msg.member?.voice.channel)
      return this.msg.reply(APP_USER_NOT_IN_VOICE_CHANNEL);

    if (!audioPlayer) {
      const makeBotConnection = await this.msg.member.voice.channel.join();

      audioPlayer = {
        state: makeBotConnection,
        tracks: {
          data: [track],
          author: [requestAuthor]
        },
        volume: 10,
        dispatcher: null
      };
    }

    try {
      audioPlayer.dispatcher = audioPlayer.state.play(track.readableStream);

      const embed = Embed.getInstance();
      embed
        .setTitle('')
        .setAuthor('We hear you 💜', CD_GIF_URL)
        .setThumbnail(track.data.thumbnail)
        .setDescription(
          `Now playing **[${track.data.title}](${track.data.url})** requested by <@${requestAuthor}>`
        )
        .setFooter(`Song duration: ${track.data.duration}`)
        .setTimestamp({} as Date)
        .setColor(APP_MAIN_COLOR);
      this.msg.channel.send({ embed });

      audioPlayer.dispatcher.on('finish', async () => {
        audioPlayer?.tracks.data.shift();
        audioPlayer?.tracks.author.shift();
        audioPlayer?.dispatcher?.destroy();

        if (audioPlayer?.tracks.data.length) {
          const musicPlaybackHandler = MusicPlaybackHandler.getInstance(
            this.bot,
            this.msg
          );
          await musicPlaybackHandler.setTrack(
            audioPlayer.tracks.data[0],
            audioPlayer.tracks.author[0]
          );
        }
      });

      audioPlayer.dispatcher.on('error', (err) => {
        throw err;
      });

      this.bot.AudioPlayers.set(this.msg.guild!.id, audioPlayer);
    } catch (e) {
      console.error(e);
      const { message } = e as Error;

      new GeneralAppError({
        bot: this.bot,
        message
      });
    }
  }

  async getTrackInfo(trackUri: string) {
    if (!trackUri.length) throw new Error('Track URI not provided');

    let response = {} as VideoMetadataResult | VideoSearchResult;
    const isValidYouTubeUrl = await isValidURL(trackUri, 'YouTube');

    if (isValidYouTubeUrl) {
      response = await yts({ videoId: ytdl.getURLVideoID(trackUri) });
    } else {
      const { videos } = await yts(trackUri);
      if (!videos.length) return;

      response = videos.at(0) as VideoSearchResult;
    }
    const { title, thumbnail, url, timestamp } = response;

    return {
      title,
      thumbnail,
      url,
      duration: timestamp
    } as Track;
  }

  async getTrack(trackUri: string) {
    let platform = '' as keyof typeof PLATFORMS;
    let parsedData: string | SpotifyPlaylist = trackUri;

    try {
      if (trackUri.includes(YOUTUBE_BASE_URL)) {
        const isValidYouTubeUrl = isValidURL(trackUri, 'YouTube');
        if (!isValidYouTubeUrl)
          throw new InvalidParameterError(
            'An invalid YouTube URL was provided'
          );

        platform = 'YouTube';
      } else if (trackUri.includes(SPOTIFY_BASE_URL)) {
        platform = 'Spotify';

        const { data }: AxiosResponse<string> = await axios.get(trackUri);
        if (!data.length) throw new Error('No data returned');

        const contentType = trackUri.includes('track') ? 'TRACK' : 'PLAYLIST';
        if (contentType) {
          parsedData = parseSpotifyResponse(
            contentType,
            data
          ) as SpotifyPlaylist;
        } else
          throw new InvalidParameterError(
            'An invalid Spotify content type was provided'
          );
      }

      const requestedTrackUri =
        typeof parsedData === 'string' ? [parsedData] : parsedData.tracks;

      const trackData = await this.downloadTrack(requestedTrackUri);

      const isPlaylist = trackData.length > 1;

      if (isPlaylist && platform === 'Spotify') {
        const spotifyPlaylist = {} as SpotifyPlaylist;

        const embed = Embed.getInstance();
        embed
          .setTitle('')
          .setAuthor(
            `"${spotifyPlaylist.name}"\nSpotify playlist by ${spotifyPlaylist.owner}`
          )
          .setDescription(
            `\n• Total playlist tracks: \`${
              spotifyPlaylist.tracks.length
            }\`\n• Playlist duration: \`${formatSecondsToStdTime(
              spotifyPlaylist.duration / 1000
            )}\``
          )
          .setThumbnail(spotifyPlaylist.cover)
          .setFooter('Spotify | Music for everyone')
          .setTimestamp({} as Date)
          .setColor(SPOTIFY_COLOR);
        this.msg.channel.send({ embed });

        embed
          .setTitle('')
          .setAuthor(APP_LOADING_PLAYLIST_TRACKS_TITLE)
          .setDescription(APP_LOADING_PLAYLIST_TRACKS_DESCRIPTION)
          .setThumbnail('')
          .setFooter('')
          .setTimestamp({} as Date)
          .setColor(APP_WARNING_COLOR);
        this.msg.channel.send({ embed });
      }

      return {
        platform,
        tracks: trackData
      } as GetTrackResult;
    } catch (e) {
      console.error(e);
      const { message } = e as Error;

      new GeneralAppError({
        bot: this.bot,
        message
      });
    }
  }

  async playTrack(track: TrackData, requestAuthor: string) {
    const embed = Embed.getInstance();
    const audioPlayer = this.bot.AudioPlayers.get(this.msg.guild!.id);

    if (!audioPlayer) {
      embed
        .setTitle('🎵  Music Playback')
        .setAuthor('')
        .setThumbnail('')
        .setDescription(
          `Joining channel \`${this.msg.member!.voice.channel!.name}\``
        )
        .setFooter('')
        .setTimestamp({} as Date)
        .setColor(APP_MAIN_COLOR);
      this.msg.channel.send({ embed });

      const musicPlaybackHandler = MusicPlaybackHandler.getInstance(
        this.bot,
        this.msg
      );
      await musicPlaybackHandler.setTrack(track, requestAuthor);
    } else {
      audioPlayer.tracks.data.push(track);
      audioPlayer.tracks.author.push(requestAuthor);
      this.bot.AudioPlayers.set(this.msg.guild!.id, audioPlayer);

      embed
        .setTitle('📃  Queue')
        .setAuthor('')
        .setThumbnail('')
        .setDescription(
          `Got it! [${track.data.title}](${
            track.data.url
          }) was added to the queue and his current position is \`${audioPlayer.tracks.data.indexOf(
            track
          )}\``
        )
        .setFooter(
          `Added by ${this.msg.author.username}`,
          this.msg.author.displayAvatarURL()
        )
        .setTimestamp(Date.now())
        .setColor(APP_MAIN_COLOR);
      this.msg.channel.send({ embed });
    }
  }
}
