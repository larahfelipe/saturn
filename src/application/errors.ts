import { SaturnError } from '../shared/errors.ts';

/** The request cannot succeed as given; the user can correct it. */
export abstract class UserInputError extends SaturnError {}

/** An external system (YouTube, Discord voice, FFmpeg) failed or refused. */
export abstract class ExternalServiceError extends SaturnError {}

export class InvalidTrackUrlError extends UserInputError {
  constructor(options?: ErrorOptions) {
    super('Not a supported YouTube video URL', options);
  }
}

export class NotInVoiceChannelError extends UserInputError {
  constructor() {
    super('The requester is not connected to a voice channel');
  }
}

export class TrackUnavailableError extends ExternalServiceError {
  readonly reason: string;

  constructor(reason: string, options?: ErrorOptions) {
    super(`Video unavailable: ${reason}`, options);
    this.reason = reason;
  }
}

export class NoAudioFormatError extends ExternalServiceError {
  constructor(options?: ErrorOptions) {
    super('No playable audio format', options);
  }
}

export class TrackResolutionError extends ExternalServiceError {
  readonly reason: string;

  constructor(reason: string, options?: ErrorOptions) {
    super(`Track resolution failed: ${reason}`, options);
    this.reason = reason;
  }
}

export class VoiceConnectionError extends ExternalServiceError {}

export class AudioStreamError extends ExternalServiceError {}

/** A pending request was cancelled because playback was stopped. */
export class PlaybackCancelledError extends SaturnError {
  constructor() {
    super('Playback was stopped before the request completed');
  }
}

/** The player no longer accepts work (disposed, or the app is shutting down). */
export class PlayerUnavailableError extends SaturnError {
  constructor() {
    super('The player is no longer accepting requests');
  }
}
