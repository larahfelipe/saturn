import type { Readable } from 'node:stream';

import type { Track } from '../../domain/music/Track.ts';

export interface TrackRequest {
  readonly url: string;
  readonly requestedBy: string;
}

export interface AudioSource {
  /**
   * Opens a fresh encoded audio byte stream. Aborting `signal` or destroying
   * the stream releases the underlying request.
   */
  open(signal: AbortSignal): Readable;
}

export interface ResolvedTrack {
  readonly track: Track;
  readonly source: AudioSource;
}

export interface TrackResolver {
  /**
   * @throws InvalidTrackUrlError, TrackUnavailableError, NoAudioFormatError,
   *   TrackResolutionError, or `signal.reason` when aborted.
   */
  resolve(request: TrackRequest, signal: AbortSignal): Promise<ResolvedTrack>;
}
