import {
  createAudioPlayer,
  createAudioResource,
  entersState,
  joinVoiceChannel,
  VoiceConnectionStatus,
  type AudioPlayer,
  type VoiceConnection
} from '@discordjs/voice';
import axios, { type AxiosResponse } from 'axios';
import { GuildMember, type CommandInteraction } from 'discord.js';
import yts, {
  type VideoMetadataResult,
  type VideoSearchResult
} from 'yt-search';
import ytdl, { type downloadOptions as DownloadOptions } from 'ytdl-core';

import { PLATFORMS } from '@/constants';
import { GeneralAppError } from '@/errors/GeneralAppError';
import { InvalidParameterError } from '@/errors/InvalidParameterError';
import type { Bot } from '@/structures/Bot';
import type {
  GetTrackResult,
  SpotifyPlaylist,
  Track,
  TrackData
} from '@/types';
import { parseSpotifyResponse } from '@/utils/ParseSpotifyResponse';
import { isValidURL } from '@/utils/ValidateURL';

export class MusicPlaybackHandler {
  private static INSTANCE: MusicPlaybackHandler;
  protected voiceConnection!: VoiceConnection;
  protected bot: Bot;
  protected interaction: CommandInteraction;

  private constructor(bot: Bot, interaction: CommandInteraction) {
    this.bot = bot;
    this.interaction = interaction;
  }

  static getInstance(bot: Bot, interaction: CommandInteraction) {
    if (
      !this.INSTANCE ||
      this.INSTANCE.interaction.guild?.id !== interaction.guild?.id ||
      this.INSTANCE.interaction.user.id !== interaction.user.id
    )
      this.INSTANCE = new MusicPlaybackHandler(bot, interaction);
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
    let audioPlayer = this.bot.subscriptions.get(
      this.interaction.guildId!
    ) as AudioPlayer;

    if (!track && audioPlayer) this.stop();

    if (!audioPlayer) {
      if (
        this.interaction.member instanceof GuildMember &&
        this.interaction.member.voice.channel
      ) {
        const voiceChannel = this.interaction.member?.voice.channel;

        this.voiceConnection = joinVoiceChannel({
          channelId: voiceChannel.id,
          guildId: voiceChannel.guild.id,
          adapterCreator: voiceChannel.guild.voiceAdapterCreator
        });
      }

      audioPlayer = createAudioPlayer();

      this.voiceConnection.subscribe(audioPlayer);

      this.bot.subscriptions.set(
        this.interaction.guildId!,
        this.voiceConnection as VoiceConnection & AudioPlayer
      );
    }

    try {
      await entersState(
        this.voiceConnection,
        VoiceConnectionStatus.Ready,
        20e3
      );

      const audioResource = createAudioResource(track.readableStream);

      audioPlayer.play(audioResource);

      // const thumbnailPredominantColors = await getImagePaletteColors(
      //   track.data.thumbnail
      // );
      // const embed = Embed.getInstance();
      // embed
      //   .setTitle('')
      //   .setAuthor({ name: APP_MUSIC_PLAYBACK_TITLE, url: CD_GIF_URL })
      //   .setThumbnail(track.data.thumbnail)
      //   .setDescription(
      //     `Now playing **[${track.data.title}](${track.data.url})** requested by <@${requestAuthor}>`
      //   )
      //   .setFooter({ text: `Track duration: ${track.data.duration}` })
      //   .setTimestamp({} as Date)
      //   .setColor(
      //     (thumbnailPredominantColors.LightVibrant ||
      //       APP_MAIN_COLOR) as ColorResolvable
      //   );
      // this.interaction.channel?.send({ embeds: [embed] });

      // audioPlayer.dispatcher.on('finish', async () => {
      //   audioPlayer?.tracks.data.shift();
      //   audioPlayer?.tracks.author.shift();

      //   const musicPlaybackHandler = MusicPlaybackHandler.getInstance(
      //     this.bot,
      //     this.msg
      //   );
      //   await musicPlaybackHandler.setTrack(
      //     audioPlayer!.tracks.data[0],
      //     audioPlayer!.tracks.author[0]
      //   );
      // });

      // audioPlayer.dispatcher.on('error', (err) => {
      //   throw err;
      // });

      // this.bot.AudioPlayers.set(this.msg.guild!.id, audioPlayer);
    } catch (e) {
      console.error(e);
      const { message } = e as Error;

      new GeneralAppError({
        bot: this.bot,
        message
      });

      this.voiceConnection.destroy();
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
          return this.interaction.reply(
            'Spotify playlists are not supported yet.'
          );

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

      // const isPlaylist = trackData.length > 1;

      // if (isPlaylist && platform === 'Spotify') {
      // const spotifyPlaylist = parsedData as SpotifyPlaylist;
      // const embed = Embed.getInstance();
      // embed
      //   .setTitle('')
      //   .setAuthor({
      //     name: `"${spotifyPlaylist.name}"\nSpotify playlist by ${spotifyPlaylist.owner}`
      //   })
      //   .setThumbnail(spotifyPlaylist.cover)
      //   .setDescription(
      //     `\n• Total playlist tracks: \`${
      //       spotifyPlaylist.tracks.length
      //     }\`\n• Playlist duration: \`${formatSecondsToStdTime(
      //       spotifyPlaylist.duration / 1000
      //     )}\``
      //   )
      //   .setFooter({ text: SPOTIFY_PHRASE })
      //   .setTimestamp({} as Date)
      //   .setColor(PLATFORMS.Spotify.color as ColorResolvable);
      // this.interaction.channel?.send({ embeds: [embed] });
      // embed
      //   .setTitle('')
      //   .setAuthor({ name: APP_LOADING_PLAYLIST_TRACKS_TITLE })
      //   .setThumbnail('')
      //   .setDescription(APP_LOADING_PLAYLIST_TRACKS_DESCRIPTION)
      //   .setFooter({ text: '' })
      //   .setTimestamp({} as Date)
      //   .setColor(APP_WARNING_COLOR);
      // this.interaction.channel?.send({ embeds: [embed] });
      // }

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
    // const embed = Embed.getInstance();
    const audioPlayer = this.bot.subscriptions.get(this.interaction.guild!.id);

    if (!audioPlayer) {
      // embed
      //   .setTitle(APP_MUSIC_PLAYBACK_TITLE)
      //   .setAuthor({ name: '' })
      //   .setThumbnail('')
      //   .setDescription(
      //     `Joining channel \`${
      //       (this.interaction.member as GuildMember).voice.channel!.name
      //     }\``
      //   )
      //   .setFooter({ text: '' })
      //   .setTimestamp({} as Date)
      //   .setColor(APP_SUCCESS_COLOR);
      // this.interaction.channel?.send({ embeds: [embed] });

      const musicPlaybackHandler = MusicPlaybackHandler.getInstance(
        this.bot,
        this.interaction
      );
      await musicPlaybackHandler.setTrack(track, requestAuthor);
    } else {
      // audioPlayer.tracks.data.push(track);
      // audioPlayer.tracks.author.push(requestAuthor);
      // this.bot.Subscriptions.set(this.interaction.guildId!, audioPlayer);
      // embed
      //   .setTitle(APP_QUEUE_TITLE)
      //   .setAuthor({ name: '' })
      //   .setThumbnail('')
      //   .setDescription(
      //     `Got it! [${track.data.title}](${
      //       track.data.url
      //     }) was added to the queue and his current position is \`${audioPlayer.tracks.data.indexOf(
      //       track
      //     )}\``
      //   )
      //   .setFooter({
      //     text: `Added by ${this.interaction.member?.user.username}`,
      //     iconURL: this.interaction.member!.user.avatar as string
      //   })
      //   .setTimestamp(Date.now())
      //   .setColor(APP_MAIN_COLOR);
      // this.interaction.channel?.send({ embeds: [embed] });
    }
  }

  async pause() {
    // const audioPlayer: AudioPlayer = this.bot.Subscriptions.get(
    //   this.interaction.guildId!
    // );
    // if (!audioPlayer || !audioPlayer.state)
    //   return this.interaction.reply(APP_NO_TRACK_PLAYING);
    // audioPlayer.pause();
  }

  async resume() {
    // const audioPlayer: AudioPlayer = this.bot.Subscriptions.get(
    //   this.interaction.guildId!
    // );
    // if (!audioPlayer || !audioPlayer.state)
    //   return this.interaction.reply(APP_NO_TRACK_PLAYING);
    // audioPlayer.unpause();
  }

  async skip() {
    // const audioPlayer: AudioPlayer = this.bot.Subscriptions.get(
    //   this.interaction.guildId!
    // );
    // if (!audioPlayer) return this.interaction.reply(APP_NO_TRACK_PLAYING);
    // if (audioPlayer.tracks.data.length === 1)
    // return this.interaction.reply(APP_QUEUE_EMPTY);
    // audioPlayer.tracks.data.shift();
    // audioPlayer.tracks.author.shift();
    // const embed = Embed.getInstance();
    // embed
    //   .setTitle(APP_SKIP_TRACK_TITLE)
    //   .setAuthor({ name: '' })
    //   .setThumbnail('')
    //   .setDescription(APP_SKIP_TRACK_DESCRIPTION)
    //   .setFooter({ text: '' })
    //   .setTimestamp({} as Date)
    //   .setColor(APP_MAIN_COLOR);
    // this.interaction.channel?.send({ embeds: [embed] });
    // const musicPlaybackHandler = MusicPlaybackHandler.getInstance(
    //   this.bot,
    //   this.msg
    // );
    // await musicPlaybackHandler.setTrack(
    //   audioPlayer.tracks.data[0],
    //   audioPlayer.tracks.author[0]
    // );
  }

  async stop() {
    // const audioPlayer: AudioPlayer = this.bot.Subscriptions.get(
    //   this.interaction.guildId!
    // );
    // if (!audioPlayer) return this.interaction.reply(APP_NO_TRACK_PLAYING);
    // const embed = Embed.getInstance();
    // embed
    //   .setTitle(APP_STOP_MUSIC_PLAYBACK_TITLE)
    //   .setAuthor({ name: '' })
    //   .setThumbnail('')
    //   .setDescription(APP_STOP_MUSIC_PLAYBACK_DESCRIPTION)
    //   .setFooter({ text: '' })
    //   .setTimestamp({} as Date)
    //   .setColor(APP_WARNING_COLOR);
    // this.interaction.channel?.send({ embeds: [embed] });
    // audioPlayer.stop();
    // this.bot.Subscriptions.delete(this.interaction.guildId!);
  }
}
