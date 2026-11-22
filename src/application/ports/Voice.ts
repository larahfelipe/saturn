import type { AudioSource } from './TrackResolver.ts';

export interface AudioSession {
  readonly channelId: string | undefined;
  destroy(): void;
  readonly elapsedMs: number;
  pause(): boolean;
  play(source: AudioSource, signal: AbortSignal): Promise<void>;
  resume(): boolean;
}

export interface ConnectOptions {
  readonly onLost: (error: Error) => void;
  readonly signal: AbortSignal;
}

export interface VoiceConnector {
  connect(target: VoiceTarget, options: ConnectOptions): Promise<AudioSession>;
}

export interface VoiceTarget {
  readonly channelId: string;
  readonly guildId: string;
}
