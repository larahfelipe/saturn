import type { Readable } from 'node:stream';
import { setTimeout as sleep } from 'node:timers/promises';

import {
  AudioPlayerStatus,
  createAudioResource,
  StreamType,
  VoiceConnectionDisconnectReason,
  VoiceConnectionStatus,
} from '@discordjs/voice';
import type {
  AudioPlayer,
  AudioPlayerError,
  AudioPlayerState,
  AudioResource,
  PlayerSubscription,
  VoiceConnection,
  VoiceConnectionState,
} from '@discordjs/voice';

import { AudioStreamError, VoiceConnectionError } from '../../application/errors.ts';
import type { Logger } from '../../application/ports/Logger.ts';
import type { AudioSource } from '../../application/ports/TrackResolver.ts';
import type { AudioSession } from '../../application/ports/Voice.ts';
import { encodeOggOpus } from './ffmpeg.ts';
import { waitForStatus } from './waitForStatus.ts';

export interface DiscordAudioSessionOptions {
  readonly bitrateKbps: number;
  readonly connection: VoiceConnection;
  readonly ffmpegPath: string;
  readonly logger: Logger;
  readonly onLost: (error: Error) => void;
  readonly player: AudioPlayer;
  readonly readyTimeoutMs: number;
  readonly reconnectTimeoutMs: number;
  readonly rejoinDelayMs: number;
  readonly startTimeoutMs: number;
}

const MAX_RECONNECT_ATTEMPTS = 5;
const CLOSE_CODE_DISCONNECTED = 4014;

interface ActiveTrack {
  ended(): void;
  failed(error: AudioPlayerError): void;
  readonly resource: AudioResource;
  started(): void;
}

export class DiscordAudioSession implements AudioSession {
  get channelId(): string | undefined {
    return this.#connection.joinConfig.channelId ?? undefined;
  }

  #active: ActiveTrack | undefined;
  readonly #bitrateKbps: number;
  readonly #connection: VoiceConnection;
  readonly #ffmpegPath: string;
  readonly #lifetime = new AbortController();
  readonly #logger: Logger;
  readonly #onLost: (error: Error) => void;
  #paused = false;
  readonly #player: AudioPlayer;
  readonly #readyTimeoutMs: number;
  readonly #reconnectTimeoutMs: number;
  #recovering = false;
  readonly #rejoinDelayMs: number;
  readonly #startTimeoutMs: number;
  readonly #subscription: PlayerSubscription;

  constructor(options: DiscordAudioSessionOptions) {
    this.#connection = options.connection;
    this.#player = options.player;
    this.#ffmpegPath = options.ffmpegPath;
    this.#bitrateKbps = options.bitrateKbps;
    this.#logger = options.logger;
    this.#onLost = options.onLost;
    this.#reconnectTimeoutMs = options.reconnectTimeoutMs;
    this.#readyTimeoutMs = options.readyTimeoutMs;
    this.#rejoinDelayMs = options.rejoinDelayMs;
    this.#startTimeoutMs = options.startTimeoutMs;

    const subscription = this.#connection.subscribe(this.#player);
    if (subscription === undefined) {
      throw new VoiceConnectionError('Voice connection was destroyed');
    }
    this.#subscription = subscription;
    this.#connection.on('stateChange', this.#onConnectionState);
    this.#player.on('stateChange', this.#onPlayerState);
    this.#player.on('error', this.#onPlayerError);
  }

  destroy(): void {
    if (this.#lifetime.signal.aborted) return;
    this.#lifetime.abort(new VoiceConnectionError('Audio session destroyed'));
    this.#connection.off('stateChange', this.#onConnectionState);
    this.#player.off('stateChange', this.#onPlayerState);
    this.#player.off('error', this.#onPlayerError);
    this.#player.stop(true);
    this.#subscription.unsubscribe();
    if (this.#connection.state.status !== VoiceConnectionStatus.Destroyed) {
      this.#connection.destroy();
    }
  }

  pause(): boolean {
    if (!this.#inProgress()) return false;
    this.#paused = true;
    this.#player.pause();
    return true;
  }

  async play(source: AudioSource, signal: AbortSignal): Promise<void> {
    this.#lifetime.signal.throwIfAborted();
    if (this.#active !== undefined) throw new AudioStreamError('A track is already playing');
    if (signal.aborted) return;
    this.#paused = false;

    const track = new AbortController();
    const stop = AbortSignal.any([signal, this.#lifetime.signal]);
    const { promise, reject, resolve } = Promise.withResolvers<undefined>();
    const finish = (): void => {
      resolve(undefined);
    };
    stop.addEventListener('abort', finish, { once: true });

    const startTimer = setTimeout(() => {
      reject(new AudioStreamError('Audio stream did not start'));
    }, this.#startTimeoutMs);

    let started = false;
    let input: Readable | undefined;
    let resource: AudioResource | undefined;
    try {
      input = source.open(track.signal);
      const { completion, output } = encodeOggOpus(input, {
        bitrateKbps: this.#bitrateKbps,
        ffmpegPath: this.#ffmpegPath,
        signal: track.signal,
      });
      completion.catch((error: unknown) => {
        if (!started) reject(error);
      });
      const playing = createAudioResource(output, { inputType: StreamType.OggOpus });
      resource = playing;
      this.#active = {
        ended: () => {
          if (playing.playStream.readableEnded) completion.then(finish, reject);
          else reject(new AudioStreamError('Audio stream stalled'));
        },
        failed: (error) => {
          reject(new AudioStreamError('Audio playback failed', { cause: error }));
        },
        resource: playing,
        started: () => {
          started = true;
          clearTimeout(startTimer);
        },
      };
      this.#player.play(playing);
      await promise;
    } finally {
      clearTimeout(startTimer);
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

  resume(): boolean {
    if (!this.#inProgress()) return false;
    this.#paused = false;
    this.#player.unpause();
    return true;
  }

  #inProgress(): boolean {
    const state = this.#player.state;
    return (
      this.#active !== undefined &&
      state.status !== AudioPlayerStatus.Idle &&
      state.resource === this.#active.resource
    );
  }

  #lose(error: Error): void {
    if (this.#lifetime.signal.aborted) return;
    this.destroy();
    this.#onLost(error);
  }

  readonly #onConnectionState = (_: VoiceConnectionState, next: VoiceConnectionState): void => {
    if (next.status === VoiceConnectionStatus.Destroyed) {
      this.#lose(new VoiceConnectionError('Voice connection was destroyed'));
    } else if (next.status !== VoiceConnectionStatus.Ready && !this.#recovering) {
      void this.#recover();
    }
  };

  readonly #onPlayerError = (error: AudioPlayerError): void => {
    if (error.resource === this.#active?.resource) this.#active.failed(error);
    else this.#logger.warn({ err: error }, 'audio player error');
  };

  readonly #onPlayerState = (previous: AudioPlayerState, next: AudioPlayerState): void => {
    if (next.status === AudioPlayerStatus.Playing) {
      if (next.resource === this.#active?.resource) this.#active.started();
      if (this.#paused) this.#player.pause();
    }
    if (
      next.status === AudioPlayerStatus.Idle &&
      previous.status !== AudioPlayerStatus.Idle &&
      previous.resource === this.#active?.resource
    ) {
      this.#active.ended();
    }
  };

  /**
   * Brings the connection back to ready, or loses the session. After close
   * code 4014 only Discord can reconnect it (channel move); any other
   * disconnect, such as the gateway being unavailable, is retried with
   * `rejoin()`, waiting longer before each attempt.
   */
  async #recover(): Promise<void> {
    this.#recovering = true;
    const lifetime = this.#lifetime.signal;
    const within = (ms: number): AbortSignal =>
      AbortSignal.any([lifetime, AbortSignal.timeout(ms)]);
    let attempts = 0;
    try {
      for (;;) {
        const state = this.#connection.state;
        if (state.status === VoiceConnectionStatus.Ready) return;
        if (state.status !== VoiceConnectionStatus.Disconnected) {
          await waitForStatus(
            this.#connection,
            [VoiceConnectionStatus.Ready, VoiceConnectionStatus.Disconnected],
            within(this.#readyTimeoutMs),
          );
          continue;
        }
        if (++attempts > MAX_RECONNECT_ATTEMPTS) {
          throw new VoiceConnectionError('Voice connection did not recover');
        }
        if (
          state.reason === VoiceConnectionDisconnectReason.WebSocketClose &&
          state.closeCode === CLOSE_CODE_DISCONNECTED
        ) {
          await waitForStatus(
            this.#connection,
            [
              VoiceConnectionStatus.Signalling,
              VoiceConnectionStatus.Connecting,
              VoiceConnectionStatus.Ready,
            ],
            within(this.#reconnectTimeoutMs),
          );
        } else {
          await sleep(attempts * this.#rejoinDelayMs, undefined, { signal: lifetime });
          if (this.#connection.state.status === VoiceConnectionStatus.Disconnected) {
            this.#logger.warn({ attempt: attempts }, 'voice connection rejoining');
            this.#connection.rejoin();
          }
        }
      }
    } catch (error) {
      this.#lose(new VoiceConnectionError('Voice connection lost', { cause: error }));
    } finally {
      this.#recovering = false;
    }
  }
}
