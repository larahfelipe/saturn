import { PassThrough } from 'node:stream';
import { setImmediate as nextMacrotask } from 'node:timers/promises';

import type { Logger } from '../../src/application/ports/Logger.ts';
import type {
  AudioSource,
  ResolvedTrack,
  TrackRequest,
  TrackResolver,
} from '../../src/application/ports/TrackResolver.ts';
import type {
  AudioSession,
  ConnectOptions,
  VoiceConnector,
  VoiceTarget,
} from '../../src/application/ports/Voice.ts';
import { makeTrack } from './tracks.ts';

/** Lets pending promise continuations and timers-free callbacks run. */
export async function flush(turns = 3): Promise<void> {
  for (let turn = 0; turn < turns; turn++) await nextMacrotask();
}

interface Deferred<T> {
  readonly promise: Promise<T>;
  resolve(value: T): void;
  reject(error: unknown): void;
}

function defer<T>(signal?: AbortSignal): Deferred<T> {
  const { promise, resolve, reject } = Promise.withResolvers<T>();
  signal?.addEventListener(
    'abort',
    () => {
      reject(signal.reason);
    },
    { once: true },
  );
  return { promise, resolve, reject };
}

export function trackUrl(id: string): string {
  return `https://www.youtube.com/watch?v=${id}`;
}

export interface ResolveCall {
  readonly request: TrackRequest;
  readonly signal: AbortSignal;
  readonly result: ResolvedTrack;
  readonly deferred: Deferred<ResolvedTrack>;
}

/** Resolves `…watch?v=<id>` URLs to tracks with that ID. Set `manual` to settle calls yourself. */
export class FakeResolver implements TrackResolver {
  readonly calls: ResolveCall[] = [];
  manual = false;
  failWith: Error | undefined;

  resolve(request: TrackRequest, signal: AbortSignal): Promise<ResolvedTrack> {
    const id = new URL(request.url).searchParams.get('v') ?? 'unknown';
    const result: ResolvedTrack = {
      track: makeTrack({ id, requestedBy: request.requestedBy }),
      source: { open: () => new PassThrough() },
    };
    const deferred = defer<ResolvedTrack>(signal);
    this.calls.push({ request, signal, result, deferred });
    if (this.failWith !== undefined) deferred.reject(this.failWith);
    else if (!this.manual) deferred.resolve(result);
    return deferred.promise;
  }
}

export interface Playback {
  readonly source: AudioSource;
  readonly signal: AbortSignal;
  /** Until the playback settles; controls are refused afterwards. */
  inProgress: boolean;
  finish(): void;
  fail(error: Error): void;
}

export class FakeAudioSession implements AudioSession {
  readonly playbacks: Playback[] = [];
  /** When false, an aborted playback only settles once `finish` or `fail` is called. */
  readonly settleOnAbort: boolean;
  /** Set it to simulate Discord moving the bot. */
  channelId: string | undefined;
  paused = false;
  destroyCount = 0;

  constructor(settleOnAbort = true, channelId?: string) {
    this.settleOnAbort = settleOnAbort;
    this.channelId = channelId;
  }

  get destroyed(): boolean {
    return this.destroyCount > 0;
  }

  get current(): Playback | undefined {
    return this.playbacks.at(-1);
  }

  play(source: AudioSource, signal: AbortSignal): Promise<void> {
    const { promise, resolve, reject } = Promise.withResolvers<undefined>();
    this.paused = false;
    const playback: Playback = {
      source,
      signal,
      inProgress: true,
      finish: () => {
        playback.inProgress = false;
        resolve(undefined);
      },
      fail: (error) => {
        playback.inProgress = false;
        reject(error);
      },
    };
    if (this.settleOnAbort) {
      signal.addEventListener(
        'abort',
        () => {
          playback.finish();
        },
        { once: true },
      );
    }
    this.playbacks.push(playback);
    return promise;
  }

  pause(): boolean {
    if (this.current?.inProgress !== true) return false;
    this.paused = true;
    return true;
  }

  resume(): boolean {
    if (this.current?.inProgress !== true) return false;
    this.paused = false;
    return true;
  }

  destroy(): void {
    this.destroyCount++;
  }
}

export interface ConnectCall {
  readonly target: VoiceTarget;
  readonly options: ConnectOptions;
  readonly session: FakeAudioSession;
  readonly deferred: Deferred<AudioSession>;
}

export class FakeVoiceConnector implements VoiceConnector {
  readonly calls: ConnectCall[] = [];
  manual = false;
  settleOnAbort = true;
  failWith: Error | undefined;

  get sessions(): FakeAudioSession[] {
    return this.calls.map(({ session }) => session);
  }

  get lastSession(): FakeAudioSession | undefined {
    return this.calls.at(-1)?.session;
  }

  connect(target: VoiceTarget, options: ConnectOptions): Promise<AudioSession> {
    const session = new FakeAudioSession(this.settleOnAbort, target.channelId);
    const deferred = defer<AudioSession>(options.signal);
    this.calls.push({ target, options, session, deferred });
    if (this.failWith !== undefined) deferred.reject(this.failWith);
    else if (!this.manual) deferred.resolve(session);
    return deferred.promise;
  }
}

export interface LogEntry {
  readonly level: 'debug' | 'info' | 'warn' | 'error';
  readonly context: Record<string, unknown>;
  readonly message: string | undefined;
}

export class RecordingLogger implements Logger {
  readonly entries: LogEntry[];
  readonly #bindings: Record<string, unknown>;

  constructor(entries: LogEntry[] = [], bindings: Record<string, unknown> = {}) {
    this.entries = entries;
    this.#bindings = bindings;
  }

  debug(context: object, message?: string): void {
    this.#record('debug', context, message);
  }

  info(context: object, message?: string): void {
    this.#record('info', context, message);
  }

  warn(context: object, message?: string): void {
    this.#record('warn', context, message);
  }

  error(context: object, message?: string): void {
    this.#record('error', context, message);
  }

  child(bindings: Record<string, unknown>): RecordingLogger {
    return new RecordingLogger(this.entries, { ...this.#bindings, ...bindings });
  }

  at(level: LogEntry['level']): LogEntry[] {
    return this.entries.filter((entry) => entry.level === level);
  }

  /** The context of the first entry logged at `level` with `message`. */
  contextOf(level: LogEntry['level'], message: string): Record<string, unknown> | undefined {
    return this.at(level).find((entry) => entry.message === message)?.context;
  }

  #record(level: LogEntry['level'], context: object, message: string | undefined): void {
    this.entries.push({ level, context: { ...this.#bindings, ...context }, message });
  }
}
