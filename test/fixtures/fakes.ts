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

export interface ConnectCall {
  readonly deferred: Deferred<AudioSession>;
  readonly options: ConnectOptions;
  readonly session: FakeAudioSession;
  readonly target: VoiceTarget;
}

export interface LogEntry {
  readonly context: Record<string, unknown>;
  readonly level: 'debug' | 'error' | 'info' | 'warn';
  readonly message: string | undefined;
}

export interface Playback {
  fail(error: Error): void;
  finish(): void;
  inProgress: boolean;
  readonly signal: AbortSignal;
  readonly source: AudioSource;
}

export interface ResolveCall {
  readonly deferred: Deferred<ResolvedTrack>;
  readonly request: TrackRequest;
  readonly result: ResolvedTrack;
  readonly signal: AbortSignal;
}

interface Deferred<T> {
  readonly promise: Promise<T>;
  reject(error: unknown): void;
  resolve(value: T): void;
}

export class FakeAudioSession implements AudioSession {
  channelId: string | undefined;
  destroyCount = 0;
  paused = false;
  readonly playbacks: Playback[] = [];
  readonly settleOnAbort: boolean;

  get current(): Playback | undefined {
    return this.playbacks.at(-1);
  }

  get destroyed(): boolean {
    return this.destroyCount > 0;
  }

  constructor(settleOnAbort = true, channelId?: string) {
    this.settleOnAbort = settleOnAbort;
    this.channelId = channelId;
  }

  destroy(): void {
    this.destroyCount++;
  }

  pause(): boolean {
    if (this.current?.inProgress !== true) return false;
    this.paused = true;
    return true;
  }

  play(source: AudioSource, signal: AbortSignal): Promise<void> {
    const { promise, reject, resolve } = Promise.withResolvers<undefined>();
    this.paused = false;
    const playback: Playback = {
      fail: (error) => {
        playback.inProgress = false;
        reject(error);
      },
      finish: () => {
        playback.inProgress = false;
        resolve(undefined);
      },
      inProgress: true,
      signal,
      source,
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

  resume(): boolean {
    if (this.current?.inProgress !== true) return false;
    this.paused = false;
    return true;
  }
}

export class FakeResolver implements TrackResolver {
  readonly calls: ResolveCall[] = [];
  failWith: Error | undefined;
  manual = false;

  resolve(request: TrackRequest, signal: AbortSignal): Promise<ResolvedTrack> {
    const id = new URL(request.url).searchParams.get('v') ?? 'unknown';
    const result: ResolvedTrack = {
      source: { open: () => new PassThrough() },
      track: makeTrack({ id, requestedBy: request.requestedBy }),
    };
    const deferred = defer<ResolvedTrack>(signal);
    this.calls.push({ deferred, request, result, signal });
    if (this.failWith !== undefined) deferred.reject(this.failWith);
    else if (!this.manual) deferred.resolve(result);
    return deferred.promise;
  }
}

export class FakeVoiceConnector implements VoiceConnector {
  readonly calls: ConnectCall[] = [];
  failWith: Error | undefined;
  manual = false;
  settleOnAbort = true;

  get lastSession(): FakeAudioSession | undefined {
    return this.calls.at(-1)?.session;
  }

  get sessions(): FakeAudioSession[] {
    return this.calls.map(({ session }) => session);
  }

  connect(target: VoiceTarget, options: ConnectOptions): Promise<AudioSession> {
    const session = new FakeAudioSession(this.settleOnAbort, target.channelId);
    const deferred = defer<AudioSession>(options.signal);
    this.calls.push({ deferred, options, session, target });
    if (this.failWith !== undefined) deferred.reject(this.failWith);
    else if (!this.manual) deferred.resolve(session);
    return deferred.promise;
  }
}

export class RecordingLogger implements Logger {
  readonly entries: LogEntry[];

  readonly #bindings: Record<string, unknown>;

  constructor(entries: LogEntry[] = [], bindings: Record<string, unknown> = {}) {
    this.entries = entries;
    this.#bindings = bindings;
  }

  at(level: LogEntry['level']): LogEntry[] {
    return this.entries.filter((entry) => entry.level === level);
  }

  child(bindings: Record<string, unknown>): RecordingLogger {
    return new RecordingLogger(this.entries, { ...this.#bindings, ...bindings });
  }

  contextOf(level: LogEntry['level'], message: string): Record<string, unknown> | undefined {
    return this.at(level).find((entry) => entry.message === message)?.context;
  }

  debug(context: object, message?: string): void {
    this.#record('debug', context, message);
  }

  error(context: object, message?: string): void {
    this.#record('error', context, message);
  }

  info(context: object, message?: string): void {
    this.#record('info', context, message);
  }

  warn(context: object, message?: string): void {
    this.#record('warn', context, message);
  }

  #record(level: LogEntry['level'], context: object, message: string | undefined): void {
    this.entries.push({ context: { ...this.#bindings, ...context }, level, message });
  }
}

export async function flush(turns = 3): Promise<void> {
  for (let turn = 0; turn < turns; turn++) await nextMacrotask();
}

export function trackUrl(id: string): string {
  return `https://www.youtube.com/watch?v=${id}`;
}

function defer<T>(signal?: AbortSignal): Deferred<T> {
  const { promise, reject, resolve } = Promise.withResolvers<T>();
  signal?.addEventListener(
    'abort',
    () => {
      reject(signal.reason);
    },
    { once: true },
  );
  return { promise, reject, resolve };
}
