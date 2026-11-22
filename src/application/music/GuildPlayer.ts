import { canTransition, IDLE, isActive, transition } from '../../domain/music/PlaybackState.ts';
import type { PlaybackEvent, PlaybackState } from '../../domain/music/PlaybackState.ts';
import type { Track } from '../../domain/music/Track.ts';
import { TrackQueue } from '../../domain/music/TrackQueue.ts';
import {
  NotListeningError,
  PlaybackCancelledError,
  PlayerUnavailableError,
  QueueFullError,
  QueuePositionError,
  VoiceConnectionError,
} from '../errors.ts';
import type { Logger } from '../ports/Logger.ts';
import type { ResolvedTrack, TrackResolver } from '../ports/TrackResolver.ts';
import type { AudioSession, VoiceConnector } from '../ports/Voice.ts';

export interface NowPlaying {
  readonly elapsedMs: number;
  readonly paused: boolean;
  readonly track: Track;
}

export interface PlayRequest {
  readonly next?: boolean;
  readonly requestedBy: string;
  readonly url: string;
  readonly voiceChannelId: string;
}

export type PlayResult =
  | { readonly position: number; readonly status: 'queued'; readonly track: Track }
  | { readonly status: 'playing'; readonly track: Track };

export const MAX_QUEUE_LENGTH = 100;
export const EMPTY_CHANNEL_TIMEOUT_MS = 30_000;

export interface GuildPlayerOptions {
  readonly emptyChannelTimeoutMs?: number;
  readonly guildId: string;
  readonly logger: Logger;
  readonly maxQueueLength?: number;
  readonly onIdle?: () => void;
  readonly resolver: TrackResolver;
  readonly voice: VoiceConnector;
}

/**
 * Playback coordinator for one guild.
 *
 * Play requests resolve concurrently and enqueue one at a time, in arrival
 * order. The request that finds no connection joins the voice channel while
 * its track resolves, and later requests share that join; once the last
 * request has failed, the player leaves. Controls are synchronous state
 * changes, so they never wait behind a slow request. Each activation owns an epoch `AbortController`; stopping
 * aborts it, which cancels in-flight resolution, connection and playback, and
 * makes every continuation of that epoch a no-op.
 */
export class GuildPlayer {
  readonly guildId: string;

  get channelId(): string | undefined {
    return this.#session?.channelId ?? this.#target;
  }
  get isActive(): boolean {
    return isActive(this.#state);
  }
  get isDisposed(): boolean {
    return this.#disposed;
  }
  get isIdle(): boolean {
    return !this.isActive && this.#pending === 0;
  }
  get nowPlaying(): NowPlaying | undefined {
    const state = this.#state;
    if (state.status !== 'playing' && state.status !== 'paused') return undefined;
    return {
      elapsedMs: this.#session?.elapsedMs ?? 0,
      paused: state.status === 'paused',
      track: state.current,
    };
  }
  get state(): PlaybackState<Track> {
    return this.#state;
  }

  get upcoming(): readonly Track[] {
    return this.#queue.snapshot().map(({ track }) => track);
  }

  #connection: Promise<AudioSession> | undefined;
  #disposed = false;
  readonly #emptyChannelTimeoutMs: number;
  #emptyChannelTimer: ReturnType<typeof setTimeout> | undefined;
  #epoch = new AbortController();
  readonly #logger: Logger;
  readonly #maxQueueLength: number;
  readonly #onIdle: (() => void) | undefined;
  #pending = 0;
  readonly #queue = new TrackQueue<ResolvedTrack>();
  readonly #resolver: TrackResolver;
  #session: AudioSession | undefined;
  #state: PlaybackState<Track> = IDLE;
  #tail: Promise<unknown> = Promise.resolve();

  #target: string | undefined;
  #track: AbortController | undefined;
  readonly #voice: VoiceConnector;

  constructor(options: GuildPlayerOptions) {
    this.guildId = options.guildId;
    this.#resolver = options.resolver;
    this.#voice = options.voice;
    this.#logger = options.logger;
    this.#maxQueueLength = options.maxQueueLength ?? MAX_QUEUE_LENGTH;
    this.#emptyChannelTimeoutMs = options.emptyChannelTimeoutMs ?? EMPTY_CHANNEL_TIMEOUT_MS;
    this.#onIdle = options.onIdle;
  }

  assertListener(voiceChannelId: string | undefined): void {
    const channelId = this.channelId;
    if (channelId !== undefined && channelId !== voiceChannelId) throw new NotListeningError();
  }

  clear(): number {
    return this.#queue.clear().length;
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    if (!this.isIdle) this.#halt(new PlayerUnavailableError());
  }

  move(from: number, to: number): Track {
    const entry = this.#queue.move(from, to);
    if (entry === undefined) throw new QueuePositionError(this.#queue.size);
    return entry.track;
  }

  pause(): boolean {
    return this.#control({ type: 'pause' }, (session) => session.pause());
  }

  async play(request: PlayRequest): Promise<PlayResult> {
    if (this.#disposed) throw new PlayerUnavailableError();
    this.assertListener(request.voiceChannelId);
    if (this.#queue.size + this.#pending >= this.#maxQueueLength) {
      throw new QueueFullError(this.#maxQueueLength);
    }
    const epoch = this.#epoch.signal;
    this.#pending++;
    try {
      const { requestedBy, url, voiceChannelId } = request;
      const requestedAt = performance.now();
      const resolution = this.#resolver.resolve({ requestedBy, url }, epoch);
      resolution.then(
        ({ track }) => {
          this.#logger.info(
            { lookupMs: millisecondsSince(requestedAt), trackId: track.id },
            'track resolved',
          );
        },
        () => undefined,
      );
      const connection =
        this.#session === undefined ? this.#join(voiceChannelId, epoch) : undefined;
      return await this.#serialize(() => this.#play(request, resolution, connection, epoch));
    } finally {
      this.#pending--;
      if (this.#pending === 0 && this.#state.status === 'waiting') this.#finish();
      else if (this.#pending === 0 && this.#state.status === 'connecting') {
        this.#halt(new PlaybackCancelledError());
      } else this.#notifyIfIdle();
    }
  }

  remove(position: number): Track {
    const entry = this.#queue.remove(position);
    if (entry === undefined) throw new QueuePositionError(this.#queue.size);
    return entry.track;
  }

  resume(): boolean {
    return this.#control({ type: 'resume' }, (session) => session.resume());
  }

  shuffle(): number {
    this.#queue.shuffle();
    return this.#queue.size;
  }

  skip(): boolean {
    if (this.#disposed || (this.#state.status !== 'playing' && this.#state.status !== 'paused')) {
      return false;
    }
    this.#track?.abort();
    return true;
  }

  skipTo(position: number): Track {
    const entry = this.#queue.skipTo(position);
    if (entry === undefined) throw new QueuePositionError(this.#queue.size);
    this.#track?.abort();
    return entry.track;
  }

  stop(): boolean {
    if (this.#disposed || this.isIdle) return false;
    this.#halt(new PlaybackCancelledError());
    return true;
  }

  updateListeners(channelId: string, listeners: number): void {
    if (this.#disposed || !this.isActive || channelId !== this.channelId) return;
    if (listeners > 0) {
      clearTimeout(this.#emptyChannelTimer);
      this.#emptyChannelTimer = undefined;
    } else {
      this.#emptyChannelTimer ??= setTimeout(() => {
        this.#leaveEmptyChannel();
      }, this.#emptyChannelTimeoutMs);
    }
  }

  async #connect(channelId: string, epoch: AbortSignal): Promise<AudioSession> {
    this.#setState({ type: 'connect' });
    this.#target = channelId;
    const startedAt = performance.now();
    let session: AudioSession;
    try {
      session = await this.#voice.connect(
        { channelId, guildId: this.guildId },
        {
          onLost: (error) => {
            this.#handleLost(epoch, error);
          },
          signal: epoch,
        },
      );
    } catch (error) {
      epoch.throwIfAborted();
      this.#disconnect();
      this.#setState({ type: 'finish' });
      throw error;
    }
    if (epoch.aborted) {
      session.destroy();
      epoch.throwIfAborted();
    }
    this.#session = session;
    this.#logger.info({ channelId, joinMs: millisecondsSince(startedAt) }, 'voice channel joined');
    return session;
  }

  #control(event: PlaybackEvent<Track>, apply: (session: AudioSession) => boolean): boolean {
    if (
      this.#disposed ||
      this.#session === undefined ||
      !canTransition(this.#state, event) ||
      !apply(this.#session)
    )
      return false;
    this.#setState(event);
    return true;
  }

  #disconnect(): void {
    clearTimeout(this.#emptyChannelTimer);
    this.#emptyChannelTimer = undefined;
    this.#session?.destroy();
    this.#session = undefined;
    this.#connection = undefined;
    this.#target = undefined;
  }

  #finish(): void {
    this.#track = undefined;
    this.#disconnect();
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
    this.#disconnect();
    if (this.#state.status === 'stopping') this.#setState({ type: 'stopped' });
    this.#notifyIfIdle();
  }

  #handleLost(epoch: AbortSignal, error: Error): void {
    if (epoch.aborted || epoch !== this.#epoch.signal) return;
    this.#logger.warn({ err: error }, 'voice connection lost');
    this.#halt(new VoiceConnectionError('Voice connection lost', { cause: error }));
  }

  #join(channelId: string, epoch: AbortSignal): Promise<AudioSession> {
    if (this.#connection === undefined) {
      this.#connection = this.#connect(channelId, epoch);
      this.#connection.catch(() => undefined);
    }
    return this.#connection;
  }

  #leaveEmptyChannel(): void {
    this.#emptyChannelTimer = undefined;
    if (this.#disposed || !this.isActive) return;
    this.#logger.info({ channelId: this.channelId }, 'leaving empty voice channel');
    this.#halt(new PlaybackCancelledError());
  }

  #notifyIfIdle(): void {
    if (!this.#disposed && this.isIdle) this.#onIdle?.();
  }

  async #play(
    request: PlayRequest,
    resolution: Promise<ResolvedTrack>,
    connection: Promise<AudioSession> | undefined,
    epoch: AbortSignal,
  ): Promise<PlayResult> {
    epoch.throwIfAborted();
    const resolved = await resolution;
    epoch.throwIfAborted();

    const session =
      this.#session ?? (await (connection ?? this.#join(request.voiceChannelId, epoch)));
    epoch.throwIfAborted();
    this.assertListener(request.voiceChannelId);
    const position =
      request.next === true ? this.#queue.enqueueNext(resolved) : this.#queue.enqueue(resolved);

    if (this.#state.status === 'connecting' || this.#state.status === 'waiting') {
      this.#runQueue(session, epoch).catch((error: unknown) => {
        this.#logger.error({ err: error }, 'playback loop failed');
        if (!epoch.aborted) this.#halt(new PlaybackCancelledError());
      });
      return { status: 'playing', track: resolved.track };
    }
    return { position, status: 'queued', track: resolved.track };
  }

  async #runQueue(session: AudioSession, epoch: AbortSignal): Promise<void> {
    while (!epoch.aborted) {
      const entry = this.#queue.dequeue();
      if (entry === undefined) {
        if (this.#pending > 0) this.#wait();
        else this.#finish();
        return;
      }

      this.#setState({ track: entry.track, type: 'start' });
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

  #serialize<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.#tail.then(operation);
    this.#tail = result.catch(() => undefined);
    return result;
  }

  #setState(event: PlaybackEvent<Track>): void {
    const previous = this.#state.status;
    this.#state = transition(this.#state, event);
    if (previous !== this.#state.status) {
      this.#logger.debug({ from: previous, to: this.#state.status }, 'playback state changed');
    }
  }

  #wait(): void {
    this.#track = undefined;
    this.#setState({ type: 'wait' });
  }
}

function millisecondsSince(start: number): number {
  return Math.round(performance.now() - start);
}
