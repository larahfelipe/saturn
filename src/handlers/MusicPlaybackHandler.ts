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
  APP_MUSIC_PLAYBACK_PHRASE,
  APP_MUSIC_PLAYBACK_TITLE,
  APP_NO_TRACK_PLAYING,
  APP_QUEUE_EMPTY,
  APP_QUEUE_TITLE,
  APP_SKIP_TRACK_DESCRIPTION,
  APP_SKIP_TRACK_TITLE,
  APP_STOP_MUSIC_PLAYBACK_DESCRIPTION,
  APP_STOP_MUSIC_PLAYBACK_TITLE,
  APP_SUCCESS_COLOR,
  APP_USER_NOT_IN_VOICE_CHANNEL,
  APP_WARNING_COLOR,
  CD_GIF_URL,
  OKAY_EMOJI,
  PLATFORMS,
  SPOTIFY_PHRASE,
  THUMBS_UP_EMOJI
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
import { getImagePaletteColors } from '@/utils/GetImagePaletteColors';
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

    if (!track && audioPlayer) {
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

      const thumbnailPredominantColors = await getImagePaletteColors(
        track.data.thumbnail
      );
      const embed = Embed.getInstance();
      embed
        .setTitle('')
        .setAuthor(APP_MUSIC_PLAYBACK_PHRASE, CD_GIF_URL)
        .setThumbnail(track.data.thumbnail)
        .setDescription(
          `Now playing **[${track.data.title}](${track.data.url})** requested by <@${requestAuthor}>`
        )
        .setFooter(`Track duration: ${track.data.duration}`)
        .setTimestamp({} as Date)
        .setColor(thumbnailPredominantColors.LightVibrant || APP_MAIN_COLOR);
      this.msg.channel.send({ embed });

      audioPlayer.dispatcher.on('finish', async () => {
        audioPlayer?.tracks.data.shift();
        audioPlayer?.tracks.author.shift();

        const musicPlaybackHandler = MusicPlaybackHandler.getInstance(
          this.bot,
          this.msg
        );
        await musicPlaybackHandler.setTrack(
          audioPlayer!.tracks.data[0],
          audioPlayer!.tracks.author[0]
        );
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
    const isValidYouTubeUrl = isValidURL(trackUri, 'YouTube');

    if (isValidYouTubeUrl) {
      response = await yts({ videoId: ytdl.getURLVideoID(trackUri) });
    } else {
      const { videos } = await yts(trackUri);
      if (!videos.length) return;

      response = videos[0] as VideoSearchResult;
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
      if (isValidURL(trackUri, 'YouTube')) {
        const isValidYouTubeUrl = isValidURL(trackUri, 'YouTube');
        if (!isValidYouTubeUrl)
          throw new InvalidParameterError(
            'An invalid YouTube URL was provided'
          );

        platform = 'YouTube';
      } else if (isValidURL(trackUri, 'Spotify')) {
        platform = 'Spotify';

        const { data }: AxiosResponse<string> = await axios.get(trackUri);
        if (!data.length) throw new Error('No data returned');

        const contentType = trackUri.includes('track') ? 'TRACK' : 'PLAYLIST';

        // Temporary fix for Spotify Playlists
        if (contentType === 'PLAYLIST')
          return this.msg.reply('Spotify playlists are not supported yet.');

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
        const spotifyPlaylist = parsedData as SpotifyPlaylist;

        const embed = Embed.getInstance();
        embed
          .setTitle('')
          .setAuthor(
            `"${spotifyPlaylist.name}"\nSpotify playlist by ${spotifyPlaylist.owner}`
          )
          .setThumbnail(spotifyPlaylist.cover)
          .setDescription(
            `\n• Total playlist tracks: \`${
              spotifyPlaylist.tracks.length
            }\`\n• Playlist duration: \`${formatSecondsToStdTime(
              spotifyPlaylist.duration / 1000
            )}\``
          )
          .setFooter(SPOTIFY_PHRASE)
          .setTimestamp({} as Date)
          .setColor(PLATFORMS.Spotify.color);
        this.msg.channel.send({ embed });

        embed
          .setTitle('')
          .setAuthor(APP_LOADING_PLAYLIST_TRACKS_TITLE)
          .setThumbnail('')
          .setDescription(APP_LOADING_PLAYLIST_TRACKS_DESCRIPTION)
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

  async play(track: TrackData, requestAuthor: string) {
    const embed = Embed.getInstance();
    const audioPlayer = this.bot.AudioPlayers.get(this.msg.guild!.id);

    if (!audioPlayer) {
      embed
        .setTitle(APP_MUSIC_PLAYBACK_TITLE)
        .setAuthor('')
        .setThumbnail('')
        .setDescription(
          `Joining channel \`${this.msg.member!.voice.channel!.name}\``
        )
        .setFooter('')
        .setTimestamp({} as Date)
        .setColor(APP_SUCCESS_COLOR);
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
        .setTitle(APP_QUEUE_TITLE)
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

  async pause(msg: Message) {
    const audioPlayer = this.bot.AudioPlayers.get(this.msg.guild!.id);
    if (!audioPlayer || !audioPlayer.state)
      return this.msg.reply(APP_NO_TRACK_PLAYING);

    await msg.react(THUMBS_UP_EMOJI);
    audioPlayer.state.dispatcher.pause();
  }

  async resume(msg: Message) {
    const audioPlayer = this.bot.AudioPlayers.get(this.msg.guild!.id);
    if (!audioPlayer || !audioPlayer.state)
      return this.msg.reply(APP_NO_TRACK_PLAYING);

    await msg.react(OKAY_EMOJI);
    audioPlayer.state.dispatcher.resume();
  }

  async skip() {
    const audioPlayer = this.bot.AudioPlayers.get(this.msg.guild!.id);
    if (!audioPlayer) return this.msg.reply(APP_NO_TRACK_PLAYING);

    if (audioPlayer.tracks.data.length === 1)
      return this.msg.reply(APP_QUEUE_EMPTY);

    audioPlayer.tracks.data.shift();
    audioPlayer.tracks.author.shift();

    const embed = Embed.getInstance();
    embed
      .setTitle(APP_SKIP_TRACK_TITLE)
      .setAuthor('')
      .setThumbnail('')
      .setDescription(APP_SKIP_TRACK_DESCRIPTION)
      .setFooter('')
      .setTimestamp({} as Date)
      .setColor(APP_MAIN_COLOR);
    this.msg.channel.send({ embed });

    const musicPlaybackHandler = MusicPlaybackHandler.getInstance(
      this.bot,
      this.msg
    );
    await musicPlaybackHandler.setTrack(
      audioPlayer.tracks.data[0],
      audioPlayer.tracks.author[0]
    );
  }

  async stop() {
    const audioPlayer = this.bot.AudioPlayers.get(this.msg.guild!.id);
    if (!audioPlayer) return this.msg.reply(APP_NO_TRACK_PLAYING);

    const embed = Embed.getInstance();
    embed
      .setTitle(APP_STOP_MUSIC_PLAYBACK_TITLE)
      .setAuthor('')
      .setThumbnail('')
      .setDescription(APP_STOP_MUSIC_PLAYBACK_DESCRIPTION)
      .setFooter('')
      .setTimestamp({} as Date)
      .setColor(APP_WARNING_COLOR);
    this.msg.channel.send({ embed });

    audioPlayer.state.disconnect();
    this.bot.AudioPlayers.delete(this.msg.guild!.id);
  }
}
