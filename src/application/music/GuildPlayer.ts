import {
  canTransition,
  IDLE,
  isActive,
  transition,
  type PlaybackEvent,
  type PlaybackState,
} from '../../domain/music/PlaybackState.ts';
import type { Track } from '../../domain/music/Track.ts';
import { TrackQueue } from '../../domain/music/TrackQueue.ts';
import { PlaybackCancelledError, PlayerUnavailableError, VoiceConnectionError } from '../errors.ts';
import type { Logger } from '../ports/Logger.ts';
import type { ResolvedTrack, TrackResolver } from '../ports/TrackResolver.ts';
import type { AudioSession, VoiceConnector } from '../ports/Voice.ts';

export interface PlayRequest {
  readonly url: string;
  readonly requestedBy: string;
  readonly voiceChannelId: string;
}

export type PlayResult =
  | { readonly status: 'playing'; readonly track: Track }
  | { readonly status: 'queued'; readonly track: Track; readonly position: number };

export interface GuildPlayerOptions {
  readonly guildId: string;
  readonly resolver: TrackResolver;
  readonly voice: VoiceConnector;
  readonly logger: Logger;
  /** Called when the player has no playback and no pending requests left. */
  readonly onIdle?: () => void;
}

/**
 * Playback coordinator for one guild.
 *
 * Play requests run one at a time, in arrival order (resolve, connect,
 * enqueue). Controls are synchronous state changes, so they never wait behind
 * a slow request. Each activation owns an epoch `AbortController`; stopping
 * aborts it, which cancels in-flight resolution, connection and playback, and
 * makes every continuation of that epoch a no-op.
 */
export class GuildPlayer {
  readonly guildId: string;
  readonly #resolver: TrackResolver;
  readonly #voice: VoiceConnector;
  readonly #logger: Logger;
  readonly #onIdle: (() => void) | undefined;

  readonly #queue = new TrackQueue<ResolvedTrack>();
  #state: PlaybackState<Track> = IDLE;
  #session: AudioSession | undefined;
  #epoch = new AbortController();
  #track: AbortController | undefined;
  #pending = 0;
  #tail: Promise<unknown> = Promise.resolve();
  #disposed = false;

  constructor(options: GuildPlayerOptions) {
    this.guildId = options.guildId;
    this.#resolver = options.resolver;
    this.#voice = options.voice;
    this.#logger = options.logger;
    this.#onIdle = options.onIdle;
  }

  get state(): PlaybackState<Track> {
    return this.#state;
  }

  get upcoming(): readonly Track[] {
    return this.#queue.snapshot().map(({ track }) => track);
  }

  /** Whether the player holds playback resources. */
  get isActive(): boolean {
    return isActive(this.#state);
  }

  /** Whether the player has neither playback nor pending requests. */
  get isIdle(): boolean {
    return !this.isActive && this.#pending === 0;
  }

  get isDisposed(): boolean {
    return this.#disposed;
  }

  /**
   * @throws PlayerUnavailableError when disposed, PlaybackCancelledError when
   *   stopped before completion, or a resolver / voice connector error.
   */
  async play(request: PlayRequest): Promise<PlayResult> {
    if (this.#disposed) throw new PlayerUnavailableError();
    const epoch = this.#epoch.signal;
    this.#pending++;
    try {
      return await this.#serialize(() => this.#play(request, epoch));
    } finally {
      this.#pending--;
      if (this.#pending === 0 && this.#state.status === 'waiting') this.#finish();
      else this.#notifyIfIdle();
    }
  }

  pause(): boolean {
    return this.#control({ type: 'pause' }, (session) => {
      session.pause();
    });
  }

  resume(): boolean {
    return this.#control({ type: 'resume' }, (session) => {
      session.resume();
    });
  }

  skip(): boolean {
    if (this.#disposed || (this.#state.status !== 'playing' && this.#state.status !== 'paused')) {
      return false;
    }
    this.#track?.abort();
    return true;
  }

  /** Stops playback, clears the queue, cancels pending requests and disconnects. */
  stop(): boolean {
    if (this.#disposed || this.isIdle) return false;
    this.#halt(new PlaybackCancelledError());
    return true;
  }

  /** Releases every resource; the player rejects all further work. Idempotent. */
  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    if (!this.isIdle) this.#halt(new PlayerUnavailableError());
  }

  async #play(request: PlayRequest, epoch: AbortSignal): Promise<PlayResult> {
    epoch.throwIfAborted();
    const { url, requestedBy } = request;
    const resolved = await this.#resolver.resolve({ url, requestedBy }, epoch);
    epoch.throwIfAborted();

    const session = this.#session ?? (await this.#connect(request.voiceChannelId, epoch));
    epoch.throwIfAborted();
    const position = this.#queue.enqueue(resolved);

    if (this.#state.status === 'connecting' || this.#state.status === 'waiting') {
      this.#runQueue(session, epoch).catch((error: unknown) => {
        this.#logger.error({ err: error }, 'playback loop failed');
        if (!epoch.aborted) this.#halt(new PlaybackCancelledError());
      });
      return { status: 'playing', track: resolved.track };
    }
    return { status: 'queued', track: resolved.track, position };
  }

  async #connect(channelId: string, epoch: AbortSignal): Promise<AudioSession> {
    this.#setState({ type: 'connect' });
    let session: AudioSession;
    try {
      session = await this.#voice.connect(
        { guildId: this.guildId, channelId },
        {
          signal: epoch,
          onLost: (error) => {
            this.#handleLost(epoch, error);
          },
        },
      );
    } catch (error) {
      epoch.throwIfAborted();
      this.#setState({ type: 'finish' });
      throw error;
    }
    if (epoch.aborted) {
      session.destroy();
      epoch.throwIfAborted();
    }
    this.#session = session;
    return session;
  }

  async #runQueue(session: AudioSession, epoch: AbortSignal): Promise<void> {
    while (!epoch.aborted) {
      const entry = this.#queue.dequeue();
      if (entry === undefined) {
        if (this.#pending > 0) this.#wait();
        else this.#finish();
        return;
      }

      this.#setState({ type: 'start', track: entry.track });
      const track = new AbortController();
      this.#track = track;
      const signal = AbortSignal.any([epoch, track.signal]);
      try {
        await session.play(entry.source, signal);
      } catch (error) {
        if (!signal.aborted) {
          this.#logger.error({ err: error, trackId: entry.track.id }, 'track playback failed');
        }
      }
    }
  }

  #control(event: PlaybackEvent<Track>, apply: (session: AudioSession) => void): boolean {
    if (this.#disposed || this.#session === undefined || !canTransition(this.#state, event)) {
      return false;
    }
    this.#setState(event);
    apply(this.#session);
    return true;
  }

  /** Queue drained with requests in flight: keep the connection for them. */
  #wait(): void {
    this.#track = undefined;
    this.#setState({ type: 'wait' });
  }

  /** Queue drained: release the connection and go idle. */
  #finish(): void {
    this.#track = undefined;
    this.#session?.destroy();
    this.#session = undefined;
    this.#setState({ type: 'finish' });
    this.#notifyIfIdle();
  }

  #halt(reason: Error): void {
    const epoch = this.#epoch;
    this.#epoch = new AbortController();
    epoch.abort(reason);

    this.#queue.clear();
    this.#track = undefined;
    if (canTransition(this.#state, { type: 'stop' })) this.#setState({ type: 'stop' });
    this.#session?.destroy();
    this.#session = undefined;
    if (this.#state.status === 'stopping') this.#setState({ type: 'stopped' });
    this.#notifyIfIdle();
  }

  #handleLost(epoch: AbortSignal, error: Error): void {
    if (epoch.aborted || epoch !== this.#epoch.signal) return;
    this.#logger.warn({ err: error }, 'voice connection lost');
    this.#halt(new VoiceConnectionError('Voice connection lost', { cause: error }));
  }

  #setState(event: PlaybackEvent<Track>): void {
    const previous = this.#state.status;
    this.#state = transition(this.#state, event);
    if (previous !== this.#state.status) {
      this.#logger.debug({ from: previous, to: this.#state.status }, 'playback state changed');
    }
  }

  #notifyIfIdle(): void {
    if (!this.#disposed && this.isIdle) this.#onIdle?.();
  }

  #serialize<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.#tail.then(operation);
    this.#tail = result.catch(() => undefined);
    return result;
  }
}
