import { describe, expect, it } from 'vitest';

import { InvalidTrackError } from '../../../../src/domain/music/errors.ts';
import { createTrack } from '../../../../src/domain/music/Track.ts';
import type { Track } from '../../../../src/domain/music/Track.ts';

const VALID: Track = {
  artworkUrl: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
  durationMs: 213_000,
  id: 'dQw4w9WgXcQ',
  requestedBy: '100000000000000001',
  title: '  Never Gonna Give You Up  ',
  url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
};

describe(createTrack, () => {
  it('creates a frozen track with a trimmed title', () => {
    const track = createTrack(VALID);

    expect(track.title).toBe('Never Gonna Give You Up');
    expect(Object.isFrozen(track)).toBe(true);
  });

  it('accepts a missing artwork and a zero duration', () => {
    const track = createTrack({ ...VALID, artworkUrl: undefined, durationMs: 0 });

    expect(track.artworkUrl).toBeUndefined();
    expect(track.durationMs).toBe(0);
  });

  it.each([
    ['id', { id: '' }],
    ['title', { title: ' '.repeat(3) }],
    ['url', { url: 'not a url' }],
    ['artworkUrl', { artworkUrl: 'nope' }],
    ['durationMs', { durationMs: -1 }],
    ['durationMs', { durationMs: 1.5 }],
    ['durationMs', { durationMs: NaN }],
    ['requestedBy', { requestedBy: '' }],
  ] satisfies [string, Partial<Track>][])('rejects an invalid %s', (field, override) => {
    expect(() => createTrack({ ...VALID, ...override })).toThrow(new InvalidTrackError(field));
  });
});
