import type { Readable } from 'node:stream';
import { setTimeout as sleep } from 'node:timers/promises';

import {
  AudioPlayerStatus,
  createAudioResource,
  StreamType,
  VoiceConnectionDisconnectReason,
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
  /** How long Discord may take to reconnect a connection it closed (moved channel). */
  readonly reconnectTimeoutMs: number;
  /** How long a reconnecting connection may take to become ready again. */
  readonly readyTimeoutMs: number;
  /** Wait before the first rejoin; each further attempt waits that much longer. */
  readonly rejoinDelayMs: number;
  /** How long a track may take to deliver its first audio. */
  readonly startTimeoutMs: number;
}

/** Disconnects in a row a recovery handles before the session is lost. */
const MAX_RECONNECT_ATTEMPTS = 5;
/** Discord closed the connection: kicked, moved to another channel, or channel deleted. */
const CLOSE_CODE_DISCONNECTED = 4014;

interface ActiveTrack {
  readonly resource: AudioResource;
  started(): void;
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
  readonly #rejoinDelayMs: number;
  readonly #startTimeoutMs: number;

  readonly #lifetime = new AbortController();
  #active: ActiveTrack | undefined;
  #recovering = false;
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

  /** @throws VoiceConnectionError once destroyed, or AudioStreamError on stream failure. */
  get channelId(): string | undefined {
    return this.#connection.joinConfig.channelId ?? undefined;
  }

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

    // The player counts missed frames only once playing, so a stream that
    // never delivers its first packet would otherwise buffer forever.
    const startTimer = setTimeout(() => {
      reject(new AudioStreamError('Audio stream did not start'));
    }, this.#startTimeoutMs);

    let started = false;
    let input: Readable | undefined;
    let resource: AudioResource | undefined;
    try {
      input = source.open(track.signal);
      const { output, completion } = encodeOggOpus(input, {
        ffmpegPath: this.#ffmpegPath,
        bitrateKbps: this.#bitrateKbps,
        signal: track.signal,
      });
      completion.catch((error: unknown) => {
        // Once audio plays, the player drains what is buffered and `ended`
        // reports the failure.
        if (!started) reject(error);
      });
      const playing = createAudioResource(output, { inputType: StreamType.OggOpus });
      resource = playing;
      this.#active = {
        resource: playing,
        started: () => {
          started = true;
          clearTimeout(startTimer);
        },
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

  pause(): boolean {
    if (!this.#inProgress()) return false;
    this.#paused = true;
    this.#player.pause();
    return true;
  }

  resume(): boolean {
    if (!this.#inProgress()) return false;
    this.#paused = false;
    this.#player.unpause();
    return true;
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

  /** Whether a track is buffering or playing; it ends once the player is done with it. */
  #inProgress(): boolean {
    const state = this.#player.state;
    return (
      this.#active !== undefined &&
      state.status !== AudioPlayerStatus.Idle &&
      state.resource === this.#active.resource
    );
  }

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

  readonly #onPlayerError = (error: AudioPlayerError): void => {
    if (error.resource === this.#active?.resource) this.#active.failed(error);
    else this.#logger.warn({ err: error }, 'audio player error');
  };

  readonly #onConnectionState = (_: VoiceConnectionState, next: VoiceConnectionState): void => {
    if (next.status === VoiceConnectionStatus.Destroyed) {
      this.#lose(new VoiceConnectionError('Voice connection was destroyed'));
    } else if (next.status !== VoiceConnectionStatus.Ready && !this.#recovering) {
      void this.#recover();
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

  #lose(error: Error): void {
    if (this.#lifetime.signal.aborted) return;
    this.destroy();
    this.#onLost(error);
  }
}
