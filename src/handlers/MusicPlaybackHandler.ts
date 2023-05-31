import {
  AudioPlayer,
  AudioPlayerStatus,
  VoiceConnection,
  VoiceConnectionDisconnectReason,
  VoiceConnectionStatus,
  createAudioPlayer,
  createAudioResource,
  entersState,
  joinVoiceChannel,
  type DiscordGatewayAdapterCreator
} from '@discordjs/voice';
import axios, { type AxiosResponse } from 'axios';
import { GuildMember, type CommandInteraction, type Message } from 'discord.js';
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

  private async downloadTrack(
    tracksUri: Array<string>
  ): Promise<Array<TrackData>> {
    if (!tracksUri.length)
      throw new InvalidParameterError('Tracks URI not provided');

    const downloadOptions: YtdlDownloadOptions = {
      filter: 'audioonly',
      quality: 'highestaudio',
      highWaterMark: 1 << 25
    };

    const tracksData = await Promise.all(
      tracksUri
        .map(async (trackUri) => {
          const trackInfo = await this.getTrackInfo(trackUri);

          if (!trackInfo)
            return console.error(
              `Couldn't get track info for ${trackUri}. Skipping...`
            );

          const trackReadableStream = ytdl(trackInfo.url, downloadOptions).on(
            'error',
            (e) => {
              throw e;
            }
          );

          return {
            data: trackInfo,
            readableStream: trackReadableStream
          };
        })
        .filter(Boolean)
    );

    return tracksData as Array<TrackData>;
  }

  private async processQueue(skipTrack = false): Promise<unknown> {
    if (
      !this.queue.length &&
      this.audioPlayer.state.status === AudioPlayerStatus.Idle
    )
      return this.stop();

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
      this.queueLock = false;

      return this.processQueue();
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
          const { guild, id: channelId } = voiceChannel;

          this.voiceConnection = joinVoiceChannel({
            channelId,
            guildId: guild.id,
            adapterCreator:
              guild.voiceAdapterCreator as DiscordGatewayAdapterCreator
          });

          this.voiceConnection.subscribe(this.audioPlayer);

          this.bot.subscriptions.set(
            this.interaction.guildId!,
            this.audioPlayer
          );
        }
      }

      await this.enqueue(broadcastData);

      this.voiceConnection.on('stateChange', async (_, newState) => {
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
      });

      this.audioPlayer.on('error', (e) => {
        throw e;
      });
    } catch (e) {
      const { message } = e as Error;
      console.error(e);

      await this.stop();

      throw message;
    }
  }

  async enqueue(data: BroadcastData) {
    this.queue.push(data);
    await this.processQueue();
  }

  async getTrackInfo(trackUri: string): Promise<Track | undefined> {
    if (!trackUri.length) throw new Error('Track URI not provided');

    const isValidYouTubeUrl = isValidURL(trackUri, PLATFORMS.YouTube.name);
    let response: VideoMetadataResult | VideoSearchResult;

    if (!isValidYouTubeUrl) {
      const { videos } = await yts(trackUri);
      if (!videos.length) return;

      response = videos[0];
    } else {
      response = await yts({ videoId: ytdl.getURLVideoID(trackUri) });
    }

    const { title, thumbnail, url, timestamp } = response;

    return {
      title,
      thumbnail,
      url,
      duration: timestamp
    };
  }

  async getTrack(trackUri: string): Promise<GetTrackResult | Message> {
    let platform: keyof typeof PLATFORMS = PLATFORMS.YouTube.name;
    let parsedData: string | SpotifyPlaylist = trackUri;

    try {
      if (isValidURL(trackUri, PLATFORMS.YouTube.name)) {
        const isValidYouTubeUrl = isValidURL(trackUri, PLATFORMS.YouTube.name);

        if (!isValidYouTubeUrl)
          throw new InvalidParameterError(
            'An invalid YouTube URL was provided'
          );
      } else if (isValidURL(trackUri, PLATFORMS.Spotify.name)) {
        platform = PLATFORMS.Spotify.name;

        const { data }: AxiosResponse<string> = await axios.get(trackUri);
        if (!data.length) throw new Error('No data returned');

        const contentType = trackUri.includes('track') ? 'TRACK' : 'PLAYLIST';

        if (!contentType)
          throw new InvalidParameterError(
            'An invalid Spotify content type was provided'
          );

        if (contentType === 'PLAYLIST')
          return this.interaction.followUp(
            'Spotify playlists are not supported yet.'
          );

        parsedData = parseSpotifyResponse(contentType, data) as SpotifyPlaylist;
      }

      const requestedTrackUrl =
        typeof parsedData === 'string' ? [parsedData] : parsedData.tracks;

      const trackData = await this.downloadTrack(requestedTrackUrl);

      return {
        platform,
        tracks: trackData
      };
    } catch (e) {
      const { message } = e as Error;

      console.error(e);

      throw message;
    }
  }

  async play(broadcastData: BroadcastData) {
    const audioPlayer = this.bot.subscriptions.get(this.interaction.guildId!);

    if (!audioPlayer && !this.queue.length) {
      await ChannelMessagingUtils.makeVCConnectionSignallingEmbed(
        this.interaction
      );

      return this.setAudioBroadcast(broadcastData);
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
