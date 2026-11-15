import {
  createAudioPlayer,
  joinVoiceChannel,
  VoiceConnectionStatus,
  type CreateVoiceConnectionOptions,
  type DiscordGatewayAdapterCreator,
  type JoinVoiceChannelOptions,
  type VoiceConnection,
} from '@discordjs/voice';

import { VoiceConnectionError } from '../../application/errors.ts';
import type { Logger } from '../../application/ports/Logger.ts';
import type {
  AudioSession,
  ConnectOptions,
  VoiceConnector,
  VoiceTarget,
} from '../../application/ports/Voice.ts';
import { DiscordAudioSession } from './DiscordAudioSession.ts';
import { opusBitrateKbps } from './ffmpeg.ts';
import { waitForStatus } from './waitForStatus.ts';

/** 5 s of 20 ms frames: tolerates network stalls before a track is considered stuck. */
const MAX_MISSED_FRAMES = 250;

export interface VoiceChannelInfo {
  readonly adapterCreator: DiscordGatewayAdapterCreator;
  /** Channel bitrate in bit/s. */
  readonly bitrate: number;
}

/** Returns the voice channel behind `target`, or `undefined` if it is not a reachable voice channel. */
export type VoiceChannelLookup = (target: VoiceTarget) => VoiceChannelInfo | undefined;

export type JoinVoiceChannel = (
  options: CreateVoiceConnectionOptions & JoinVoiceChannelOptions,
) => VoiceConnection;

export interface VoiceConnectionManagerOptions {
  readonly channels: VoiceChannelLookup;
  readonly ffmpegPath: string;
  readonly logger: Logger;
  readonly joinTimeoutMs?: number;
  readonly reconnectTimeoutMs?: number;
  readonly rejoinDelayMs?: number;
  readonly trackStartTimeoutMs?: number;
  readonly join?: JoinVoiceChannel;
}

/** Joins voice channels with @discordjs/voice and hands each connection to an audio session. */
export class VoiceConnectionManager implements VoiceConnector {
  readonly #channels: VoiceChannelLookup;
  readonly #ffmpegPath: string;
  readonly #logger: Logger;
  readonly #joinTimeoutMs: number;
  readonly #reconnectTimeoutMs: number;
  readonly #rejoinDelayMs: number;
  readonly #trackStartTimeoutMs: number;
  readonly #join: JoinVoiceChannel;

  constructor(options: VoiceConnectionManagerOptions) {
    this.#channels = options.channels;
    this.#ffmpegPath = options.ffmpegPath;
    this.#logger = options.logger;
    this.#joinTimeoutMs = options.joinTimeoutMs ?? 15_000;
    this.#reconnectTimeoutMs = options.reconnectTimeoutMs ?? 5_000;
    this.#rejoinDelayMs = options.rejoinDelayMs ?? 2_000;
    this.#trackStartTimeoutMs = options.trackStartTimeoutMs ?? 20_000;
    this.#join = options.join ?? joinVoiceChannel;
  }

  async connect(target: VoiceTarget, options: ConnectOptions): Promise<AudioSession> {
    const { signal, onLost } = options;
    signal.throwIfAborted();
    const channel = this.#channels(target);
    if (channel === undefined) throw new VoiceConnectionError('Voice channel is not available');

    const logger = this.#logger.child({ guildId: target.guildId, channelId: target.channelId });
    const connection = this.#join({
      guildId: target.guildId,
      channelId: target.channelId,
      adapterCreator: channel.adapterCreator,
      selfDeaf: true,
      selfMute: false,
    });
    connection.on('error', (error) => {
      logger.warn({ err: error }, 'voice connection error');
    });

    try {
      await waitForStatus(
        connection,
        [VoiceConnectionStatus.Ready],
        AbortSignal.any([signal, AbortSignal.timeout(this.#joinTimeoutMs)]),
      );
      return new DiscordAudioSession({
        connection,
        player: createAudioPlayer({ behaviors: { maxMissedFrames: MAX_MISSED_FRAMES } }),
        ffmpegPath: this.#ffmpegPath,
        bitrateKbps: opusBitrateKbps(channel.bitrate),
        logger,
        onLost,
        reconnectTimeoutMs: this.#reconnectTimeoutMs,
        readyTimeoutMs: this.#joinTimeoutMs,
        rejoinDelayMs: this.#rejoinDelayMs,
        startTimeoutMs: this.#trackStartTimeoutMs,
      });
    } catch (error) {
      if (connection.state.status !== VoiceConnectionStatus.Destroyed) connection.destroy();
      signal.throwIfAborted();
      throw new VoiceConnectionError('Could not join the voice channel', { cause: error });
    }
  }
}
