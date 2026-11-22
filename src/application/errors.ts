import { SaturnError } from '../shared/errors.ts';

export type VoiceChannelProblem = 'afk' | 'full' | 'missing-permissions' | 'stage';

export abstract class ExternalServiceError extends SaturnError {}

export class AudioStreamError extends ExternalServiceError {}

export abstract class UserInputError extends SaturnError {}

export class InvalidTrackUrlError extends UserInputError {
  constructor(options?: ErrorOptions) {
    super('Not a supported YouTube video URL', options);
  }
}

export class NoAudioFormatError extends ExternalServiceError {
  constructor(options?: ErrorOptions) {
    super('No playable audio format', options);
  }
}

export class NotInVoiceChannelError extends UserInputError {
  constructor() {
    super('The requester is not connected to a voice channel');
  }
}

export class NotListeningError extends UserInputError {
  constructor() {
    super("Requester is not in the bot's voice channel");
  }
}

export class PlaybackCancelledError extends SaturnError {
  constructor() {
    super('Playback was stopped before the request completed');
  }
}

export class PlayerUnavailableError extends SaturnError {
  constructor() {
    super('The player is no longer accepting requests');
  }
}

export class QueueFullError extends UserInputError {
  readonly limit: number;

  constructor(limit: number) {
    super(`The queue already holds ${limit} songs`);
    this.limit = limit;
  }
}

export class QueuePositionError extends UserInputError {
  readonly size: number;

  constructor(size: number) {
    super(`No song at that queue position; the queue holds ${size}`);
    this.size = size;
  }
}

export class RateLimitedError extends UserInputError {
  readonly retryAfterMs: number;

  constructor(retryAfterMs: number) {
    super(`Too many requests; allowed again in ${retryAfterMs} ms`);
    this.retryAfterMs = retryAfterMs;
  }
}

export class TrackResolutionError extends ExternalServiceError {
  readonly reason: string;

  constructor(reason: string, options?: ErrorOptions) {
    super(`Track resolution failed: ${reason}`, options);
    this.reason = reason;
  }
}

export class TrackUnavailableError extends ExternalServiceError {
  readonly reason: string;

  constructor(reason: string, options?: ErrorOptions) {
    super(`Video unavailable: ${reason}`, options);
    this.reason = reason;
  }
}

export class VoiceChannelUnusableError extends UserInputError {
  readonly problem: VoiceChannelProblem;

  constructor(problem: VoiceChannelProblem) {
    super(`Cannot play in this voice channel: ${problem}`);
    this.problem = problem;
  }
}

export class VoiceConnectionError extends ExternalServiceError {}
