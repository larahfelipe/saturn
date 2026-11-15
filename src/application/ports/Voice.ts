import type { AudioSource } from './TrackResolver.ts';

export interface VoiceTarget {
  readonly guildId: string;
  readonly channelId: string;
}

/** A ready voice connection with its audio output. Owned by one guild player. */
export interface AudioSession {
  /** The voice channel the session is in, following moves by Discord; undefined if unknown. */
  readonly channelId: string | undefined;
  /**
   * Streams `source` until it ends. Resolves when playback finishes or
   * `signal` aborts, and rejects when the stream or encoder fails. Resources
   * opened for the track are released before the promise settles.
   */
  play(source: AudioSource, signal: AbortSignal): Promise<void>;
  /** @returns false when no track is in progress (between tracks), changing nothing. */
  pause(): boolean;
  /** @returns false when no track is in progress (between tracks), changing nothing. */
  resume(): boolean;
  /** Stops playback and disconnects. Idempotent. */
  destroy(): void;
}

export interface ConnectOptions {
  readonly signal: AbortSignal;
  /** Called once if the connection is lost and cannot be recovered. */
  readonly onLost: (error: Error) => void;
}

export interface VoiceConnector {
  /** @throws VoiceConnectionError, or `options.signal.reason` when aborted. */
  connect(target: VoiceTarget, options: ConnectOptions): Promise<AudioSession>;
}
