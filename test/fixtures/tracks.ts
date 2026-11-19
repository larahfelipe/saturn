import { createTrack } from '../../src/domain/music/Track.ts';
import type { Track } from '../../src/domain/music/Track.ts';

export function makeTrack(overrides: Partial<Track> = {}): Track {
  const id = overrides.id ?? 'dQw4w9WgXcQ';
  return createTrack({
    artworkUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    durationMs: 213_000,
    id,
    requestedBy: '100000000000000001',
    title: `Track ${id}`,
    url: `https://www.youtube.com/watch?v=${id}`,
    ...overrides,
  });
}
