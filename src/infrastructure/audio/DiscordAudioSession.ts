import type { Readable } from 'node:stream';

import {
  AudioPlayerStatus,
  createAudioResource,
  StreamType,
  VoiceConnectionStatus,
  type AudioPlayer,
  type AudioPlayerError,
  type AudioPlayerState,
  type AudioResource,
  type PlayerSubscription,
  type VoiceConnection,
  type VoiceConnectionState,
} from '@discordjs/voice';

import { AudioStreamError, VoiceConnectionError } from '../../application/errors.ts';
import type { Logger } from '../../application/ports/Logger.ts';
import type { AudioSource } from '../../application/ports/TrackResolver.ts';
import type { AudioSession } from '../../application/ports/Voice.ts';
import { encodeOggOpus } from './ffmpeg.ts';
import { waitForStatus } from './waitForStatus.ts';

export interface DiscordAudioSessionOptions {
  /** A ready connection; the session takes ownership of it. */
  readonly connection: VoiceConnection;
  readonly player: AudioPlayer;
  readonly ffmpegPath: string;
  readonly bitrateKbps: number;
  readonly logger: Logger;
  readonly onLost: (error: Error) => void;
  /** How long a disconnected connection may take to start reconnecting. */
  readonly reconnectTimeoutMs: number;
  /** How long a reconnecting connection may take to become ready again. */
  readonly readyTimeoutMs: number;
}

interface ActiveTrack {
  readonly resource: AudioResource;
  ended(): void;
  failed(error: AudioPlayerError): void;
}

/**
 * Plays tracks on one voice connection: each track is a source stream piped
 * through FFmpeg into an Ogg/Opus audio resource. Owns the connection and
 * recovers it from transient disconnects.
 */
export class DiscordAudioSession implements AudioSession {
  readonly #connection: VoiceConnection;
  readonly #player: AudioPlayer;
  readonly #subscription: PlayerSubscription;
  readonly #ffmpegPath: string;
  readonly #bitrateKbps: number;
  readonly #logger: Logger;
  readonly #onLost: (error: Error) => void;
  readonly #reconnectTimeoutMs: number;
  readonly #readyTimeoutMs: number;

  readonly #lifetime = new AbortController();
  #active: ActiveTrack | undefined;
  /** Requested pause; reapplied when the player (re)enters the playing state. */
  #paused = false;

  /** @throws VoiceConnectionError when the connection was already destroyed. */
  constructor(options: DiscordAudioSessionOptions) {
    this.#connection = options.connection;
    this.#player = options.player;
    this.#ffmpegPath = options.ffmpegPath;
    this.#bitrateKbps = options.bitrateKbps;
    this.#logger = options.logger;
    this.#onLost = options.onLost;
    this.#reconnectTimeoutMs = options.reconnectTimeoutMs;
    this.#readyTimeoutMs = options.readyTimeoutMs;

    const subscription = this.#connection.subscribe(this.#player);
    if (subscription === undefined) {
      throw new VoiceConnectionError('Voice connection was destroyed');
    }
    this.#subscription = subscription;
    this.#connection.on('stateChange', this.#onConnectionState);
    this.#player.on('stateChange', this.#onPlayerState);
    this.#player.on('error', this.#onPlayerError);
  }

  /** @throws VoiceConnectionError once destroyed, or AudioStreamError on stream failure. */
  async play(source: AudioSource, signal: AbortSignal): Promise<void> {
    this.#lifetime.signal.throwIfAborted();
    if (this.#active !== undefined) throw new AudioStreamError('A track is already playing');
    if (signal.aborted) return;
    this.#paused = false;

    const track = new AbortController();
    const stop = AbortSignal.any([signal, this.#lifetime.signal]);
    const { promise, resolve, reject } = Promise.withResolvers<undefined>();
    const finish = (): void => {
      resolve(undefined);
    };
    stop.addEventListener('abort', finish, { once: true });

    let input: Readable | undefined;
    let resource: AudioResource | undefined;
    try {
      input = source.open(track.signal);
      const { output, completion } = encodeOggOpus(input, {
        ffmpegPath: this.#ffmpegPath,
        bitrateKbps: this.#bitrateKbps,
        signal: track.signal,
      });
      completion.catch(reject);
      const playing = createAudioResource(output, { inputType: StreamType.OggOpus });
      resource = playing;
      this.#active = {
        resource: playing,
        ended: () => {
          if (playing.playStream.readableEnded) completion.then(finish, reject);
          else reject(new AudioStreamError('Audio stream stalled'));
        },
        failed: (error) => {
          reject(new AudioStreamError('Audio playback failed', { cause: error }));
        },
      };
      this.#player.play(playing);
      await promise;
    } finally {
      stop.removeEventListener('abort', finish);
      this.#active = undefined;
      track.abort();
      input?.destroy();
      const state = this.#player.state;
      if (state.status !== AudioPlayerStatus.Idle && state.resource === resource) {
        this.#player.stop(true);
      }
    }
  }

  pause(): void {
    this.#paused = true;
    this.#player.pause();
  }

  resume(): void {
    this.#paused = false;
    this.#player.unpause();
  }

  destroy(): void {
    if (this.#lifetime.signal.aborted) return;
    this.#lifetime.abort(new VoiceConnectionError('Audio session destroyed'));
    this.#connection.off('stateChange', this.#onConnectionState);
    this.#player.off('stateChange', this.#onPlayerState);
    this.#player.stop(true);
    this.#subscription.unsubscribe();
    if (this.#connection.state.status !== VoiceConnectionStatus.Destroyed) {
      this.#connection.destroy();
    }
  }

  readonly #onPlayerState = (previous: AudioPlayerState, next: AudioPlayerState): void => {
    if (next.status === AudioPlayerStatus.Playing && this.#paused) this.#player.pause();
    if (
      next.status === AudioPlayerStatus.Idle &&
      previous.status !== AudioPlayerStatus.Idle &&
      previous.resource === this.#active?.resource
    ) {
      this.#active.ended();
    }
  };

  readonly #onPlayerError = (error: AudioPlayerError): void => {
    if (error.resource === this.#active?.resource) this.#active.failed(error);
    else this.#logger.warn({ err: error }, 'audio player error');
  };

  readonly #onConnectionState = (_: VoiceConnectionState, next: VoiceConnectionState): void => {
    if (next.status === VoiceConnectionStatus.Disconnected) void this.#recover();
    else if (next.status === VoiceConnectionStatus.Destroyed) {
      this.#lose(new VoiceConnectionError('Voice connection was destroyed'));
    }
  };

  /**
   * A disconnect is transient when the connection starts signalling or
   * connecting again (rejoin, channel move); otherwise the session is lost.
   */
  async #recover(): Promise<void> {
    const lifetime = this.#lifetime.signal;
    try {
      await waitForStatus(
        this.#connection,
        [VoiceConnectionStatus.Signalling, VoiceConnectionStatus.Connecting],
        AbortSignal.any([lifetime, AbortSignal.timeout(this.#reconnectTimeoutMs)]),
      );
      await waitForStatus(
        this.#connection,
        [VoiceConnectionStatus.Ready],
        AbortSignal.any([lifetime, AbortSignal.timeout(this.#readyTimeoutMs)]),
      );
    } catch (error) {
      this.#lose(new VoiceConnectionError('Voice connection lost', { cause: error }));
    }
  }

  #lose(error: Error): void {
    if (this.#lifetime.signal.aborted) return;
    this.destroy();
    this.#onLost(error);
  }
}
