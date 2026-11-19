import { describe, expect, it } from 'vitest';

import { ffmpegArguments, opusBitrateKbps } from '../../../../src/infrastructure/audio/ffmpeg.ts';

describe(opusBitrateKbps, () => {
  it.each([
    [64_000, 64],
    [96_500, 96],
    [128_000, 128],
    [384_000, 128],
    [8000, 8],
    [0, 8],
  ])('maps a %i bit/s channel to %i kbit/s', (channelBitrate, expected) => {
    expect(opusBitrateKbps(channelBitrate)).toBe(expected);
  });
});

describe(ffmpegArguments, () => {
  it('encodes stdin to 48 kHz stereo Ogg/Opus on stdout at the given bitrate', () => {
    expect(ffmpegArguments(96)).toEqual([
      '-hide_banner',
      '-loglevel',
      'error',
      '-i',
      'pipe:0',
      '-vn',
      '-c:a',
      'libopus',
      '-b:a',
      '96k',
      '-ar',
      '48000',
      '-ac',
      '2',
      '-f',
      'ogg',
      'pipe:1',
    ]);
  });
});
