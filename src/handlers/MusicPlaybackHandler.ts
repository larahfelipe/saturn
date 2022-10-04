import {
  AudioPlayer,
  AudioPlayerStatus,
  createAudioPlayer,
  createAudioResource,
  entersState,
  joinVoiceChannel,
  VoiceConnection,
  VoiceConnectionDisconnectReason,
  VoiceConnectionStatus
} from '@discordjs/voice';
import axios, { type AxiosResponse } from 'axios';
import { GuildMember, type CommandInteraction } from 'discord.js';
import yts, {
  type VideoMetadataResult,
  type VideoSearchResult
} from 'yt-search';
import ytdl, { type downloadOptions as YtdlDownloadOptions } from 'ytdl-core';

import {
  APP_NO_TRACK_PLAYING,
  MAX_VOICE_CONNECTION_JOIN_ATTEMPTS,
  PLATFORMS
} from '@/constants';
import { GeneralAppError } from '@/errors/GeneralAppError';
import { InvalidParameterError } from '@/errors/InvalidParameterError';
import type { VCWebSocketCloseError } from '@/errors/VCWebSocketCloseError';
import type { Bot } from '@/structures/Bot';
import type {
  BroadcastData,
  GetTrackResult,
  Queue,
  SpotifyPlaylist,
  Track,
  TrackData
} from '@/types';
import { ChannelMessagingUtils } from '@/utils/ChannelMessagingUtils';
import { parseSpotifyResponse } from '@/utils/ParseSpotifyResponse';
import { isValidURL } from '@/utils/ValidateURL';

type VoiceConnectionNewState = {
  status: VoiceConnectionStatus;
  reason: VoiceConnectionDisconnectReason;
  closeCode: number;
};

export class MusicPlaybackHandler {
  private static INSTANCE: MusicPlaybackHandler;
  protected bot: Bot;
  protected interaction: CommandInteraction;
  protected audioPlayer!: AudioPlayer;
  protected voiceConnection!: VoiceConnection;
  protected queueLock = false;
  queue: Queue;

  private constructor(bot: Bot, interaction: CommandInteraction) {
    this.bot = bot;
    this.interaction = interaction;
    this.queue = [];
  }

  static getInstance(bot: Bot, interaction: CommandInteraction) {
    if (
      !this.INSTANCE ||
      this.INSTANCE.interaction.guild?.id !== interaction.guild?.id
    )
      this.INSTANCE = new MusicPlaybackHandler(bot, interaction);
    return this.INSTANCE;
  }

  private async downloadTrack(tracksUri: string[]) {
    if (!tracksUri.length)
      throw new InvalidParameterError('Tracks URI not provided');

    const downloadOptions: YtdlDownloadOptions = {
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
          (e) => {
            throw e;
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

  private async processQueue(skipTrack = false): Promise<unknown> {
    if (
      !this.queue.length &&
      this.audioPlayer.state.status === AudioPlayerStatus.Idle
    )
      return await this.stop();

    if (
      this.queueLock ||
      (this.audioPlayer.state.status !== AudioPlayerStatus.Idle && !skipTrack)
    )
      return;

    this.queueLock = true;

    const broadcastData = this.queue.shift()!;
    try {
      const audioResource = createAudioResource(
        broadcastData.track.readableStream
      );

      this.audioPlayer.play(audioResource);

      await ChannelMessagingUtils.makeAudioPlayerTrackPlayingEmbed({
        interaction: this.interaction,
        payload: broadcastData
      });

      this.queueLock = false;
    } catch (e) {
      console.error(e);
      const { message } = e as Error;
      this.queueLock = false;

      new GeneralAppError({
        bot: this.bot,
        message
      });

      return await this.processQueue();
    }
  }

  private async setAudioBroadcast(broadcastData: BroadcastData) {
    try {
      if (!this.audioPlayer) {
        if (
          this.interaction.member instanceof GuildMember &&
          this.interaction.member.voice.channel
        ) {
          this.audioPlayer = createAudioPlayer();

          const voiceChannel = this.interaction.member?.voice.channel;

          this.voiceConnection = joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId: voiceChannel.guild.id,
            adapterCreator: voiceChannel.guild.voiceAdapterCreator
          });

          this.voiceConnection.subscribe(this.audioPlayer);

          this.bot.subscriptions.set(
            this.interaction.guildId!,
            this.audioPlayer
          );
        }
      }

      await this.enqueue(broadcastData);

      this.voiceConnection.on('stateChange', async (_: any, newState: any) => {
        const { status, reason, closeCode } =
          newState as VoiceConnectionNewState;

        const onReadyToMakeVoiceConnection =
          status === VoiceConnectionStatus.Connecting ||
          status === VoiceConnectionStatus.Signalling;

        const onVoiceConnectionDisconnected =
          status === VoiceConnectionStatus.Disconnected;

        if (onReadyToMakeVoiceConnection) {
          try {
            await entersState(
              this.voiceConnection,
              VoiceConnectionStatus.Ready,
              20_000 // 20 seconds
            );
          } catch (e) {
            if (
              this.voiceConnection.state.status !==
              VoiceConnectionStatus.Destroyed
            )
              this.voiceConnection.destroy();

            throw e;
          }
        } else if (onVoiceConnectionDisconnected) {
          const maybeReestablishVoiceConnection =
            reason === VoiceConnectionDisconnectReason.WebSocketClose &&
            closeCode === 4014;

          const notReachedMaxReconnectAttempts =
            this.voiceConnection.rejoinAttempts <
            MAX_VOICE_CONNECTION_JOIN_ATTEMPTS;

          if (maybeReestablishVoiceConnection) {
            try {
              await entersState(
                this.voiceConnection,
                VoiceConnectionStatus.Connecting,
                5_000 // 5 seconds
              );
            } catch (e) {
              throw e as VCWebSocketCloseError;
            }
          } else if (notReachedMaxReconnectAttempts) {
            this.voiceConnection.rejoinAttempts++;
            this.voiceConnection.rejoin();
          } else {
            this.voiceConnection.destroy();
          }
        }
      });

      this.voiceConnection.on('error', (e) => {
        throw e;
      });

      this.audioPlayer.on('stateChange', async (oldState, newState) => {
        const onFinishPlaying =
          newState.status === AudioPlayerStatus.Idle &&
          oldState.status !== AudioPlayerStatus.Idle;

        if (onFinishPlaying) await this.processQueue();

        // const onStartPlaying =
        //   newState.status === AudioPlayerStatus.Playing &&
        //   oldState.status !== AudioPlayerStatus.Paused;
      });

      this.audioPlayer.on('error', (e) => {
        throw e;
      });
    } catch (e) {
      const { message } = e as Error;
      console.error(e);

      await this.stop();

      new GeneralAppError({
        bot: this.bot,
        message
      });
    }
  }

  async enqueue(data: BroadcastData) {
    this.queue.push(data);
    await this.processQueue();
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
    let platform: keyof typeof PLATFORMS = 'YouTube';
    let parsedData: string | SpotifyPlaylist = trackUri;

    try {
      if (isValidURL(trackUri, 'YouTube')) {
        const isValidYouTubeUrl = isValidURL(trackUri, 'YouTube');
        if (!isValidYouTubeUrl)
          throw new InvalidParameterError(
            'An invalid YouTube URL was provided'
          );
      } else if (isValidURL(trackUri, 'Spotify')) {
        platform = 'Spotify';

        const { data }: AxiosResponse<string> = await axios.get(trackUri);
        if (!data.length) throw new Error('No data returned');

        const contentType = trackUri.includes('track') ? 'TRACK' : 'PLAYLIST';

        // Temporary fix for Spotify Playlists
        if (contentType === 'PLAYLIST')
          return this.interaction.followUp(
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

  async play(broadcastData: BroadcastData) {
    const audioPlayer = this.bot.subscriptions.get(this.interaction.guildId!);

    if (!audioPlayer && !this.queue.length) {
      await ChannelMessagingUtils.makeVCConnectionSignallingEmbed(
        this.interaction
      );
      return await this.setAudioBroadcast(broadcastData);
    }

    await this.setAudioBroadcast(broadcastData);

    await ChannelMessagingUtils.makeAudioPlayerQueueCreationEmbed({
      interaction: this.interaction,
      payload: {
        broadcastData,
        queue: this.queue
      }
    });
  }

  async pause() {
    const audioPlayer = this.bot.subscriptions.get(this.interaction.guildId!);
    if (!audioPlayer) {
      await this.interaction.followUp(APP_NO_TRACK_PLAYING);
      this.interaction.replied = true;
      return;
    }

    this.audioPlayer.pause();
  }

  async resume() {
    const audioPlayer = this.bot.subscriptions.get(this.interaction.guildId!);
    if (!audioPlayer) {
      await this.interaction.followUp(APP_NO_TRACK_PLAYING);
      this.interaction.replied = true;
      return;
    }

    this.audioPlayer.unpause();
  }

  async skip() {
    const audioPlayer = this.bot.subscriptions.get(this.interaction.guildId!);
    if (!audioPlayer) {
      await this.interaction.followUp(APP_NO_TRACK_PLAYING);
      this.interaction.replied = true;
      return;
    }

    await ChannelMessagingUtils.makeAudioPlayerTrackSkippedEmbed(
      this.interaction
    );

    await this.processQueue(true);
  }

  async stop(shouldNotifyChannel = false) {
    const audioPlayer = this.bot.subscriptions.get(this.interaction.guildId!);
    if (!audioPlayer && shouldNotifyChannel) {
      await this.interaction.followUp(APP_NO_TRACK_PLAYING);
      this.interaction.replied = true;
      return;
    }

    if (shouldNotifyChannel)
      await ChannelMessagingUtils.makeAudioPlayerStoppedEmbed(this.interaction);

    if (this.audioPlayer instanceof AudioPlayer) {
      this.audioPlayer.removeAllListeners();
      this.audioPlayer.stop(true);
    }

    if (
      this.voiceConnection instanceof VoiceConnection &&
      this.voiceConnection.state.status !== VoiceConnectionStatus.Destroyed
    ) {
      this.voiceConnection.removeAllListeners();
      this.voiceConnection.destroy();
    }

    this.audioPlayer = null as any;
    this.voiceConnection = null as any;
    this.bot.subscriptions.delete(this.interaction.guildId!);
    this.queueLock = false;
    this.queue = [];
  }
}
