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
  resolve(request: TrackRequest, signal: AbortSignal): Promise<ResolvedTrack>;
}
