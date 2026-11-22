import type { Readable } from 'node:stream';

import type { Track } from '../../domain/music/Track.ts';

export interface AudioSource {
  open(signal: AbortSignal): Readable;
}

export interface ResolvedTrack {
  readonly source: AudioSource;
  readonly track: Track;
}

export interface TrackRequest {
  readonly requestedBy: string;
  readonly url: string;
}

export interface TrackResolver {
  /** Throws instead of rejecting for a URL it can never resolve, before any I/O. */
  resolve(request: TrackRequest, signal: AbortSignal): Promise<ResolvedTrack>;
}
