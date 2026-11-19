import { createAudioPlayer, joinVoiceChannel, VoiceConnectionStatus } from '@discordjs/voice';
import type {
  CreateVoiceConnectionOptions,
  DiscordGatewayAdapterCreator,
  JoinVoiceChannelOptions,
  VoiceConnection,
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

const MAX_MISSED_FRAMES = 250;

export type JoinVoiceChannel = (
  options: CreateVoiceConnectionOptions & JoinVoiceChannelOptions,
) => VoiceConnection;

export interface VoiceChannelInfo {
  readonly adapterCreator: DiscordGatewayAdapterCreator;
  readonly bitrate: number;
}

export type VoiceChannelLookup = (target: VoiceTarget) => VoiceChannelInfo | undefined;

export interface VoiceConnectionManagerOptions {
  readonly channels: VoiceChannelLookup;
  readonly ffmpegPath: string;
  readonly join?: JoinVoiceChannel;
  readonly joinTimeoutMs?: number;
  readonly logger: Logger;
  readonly reconnectTimeoutMs?: number;
  readonly rejoinDelayMs?: number;
  readonly trackStartTimeoutMs?: number;
}

export class VoiceConnectionManager implements VoiceConnector {
  readonly #channels: VoiceChannelLookup;
  readonly #ffmpegPath: string;
  readonly #join: JoinVoiceChannel;
  readonly #joinTimeoutMs: number;
  readonly #logger: Logger;
  readonly #reconnectTimeoutMs: number;
  readonly #rejoinDelayMs: number;
  readonly #trackStartTimeoutMs: number;

  constructor(options: VoiceConnectionManagerOptions) {
    this.#channels = options.channels;
    this.#ffmpegPath = options.ffmpegPath;
    this.#logger = options.logger;
    this.#joinTimeoutMs = options.joinTimeoutMs ?? 15_000;
    this.#reconnectTimeoutMs = options.reconnectTimeoutMs ?? 5000;
    this.#rejoinDelayMs = options.rejoinDelayMs ?? 2000;
    this.#trackStartTimeoutMs = options.trackStartTimeoutMs ?? 20_000;
    this.#join = options.join ?? joinVoiceChannel;
  }

  async connect(target: VoiceTarget, options: ConnectOptions): Promise<AudioSession> {
    const { onLost, signal } = options;
    signal.throwIfAborted();
    const channel = this.#channels(target);
    if (channel === undefined) throw new VoiceConnectionError('Voice channel is not available');

    const logger = this.#logger.child({ channelId: target.channelId, guildId: target.guildId });
    const connection = this.#join({
      adapterCreator: channel.adapterCreator,
      channelId: target.channelId,
      guildId: target.guildId,
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
        bitrateKbps: opusBitrateKbps(channel.bitrate),
        connection,
        ffmpegPath: this.#ffmpegPath,
        logger,
        onLost,
        player: createAudioPlayer({ behaviors: { maxMissedFrames: MAX_MISSED_FRAMES } }),
        readyTimeoutMs: this.#joinTimeoutMs,
        reconnectTimeoutMs: this.#reconnectTimeoutMs,
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
