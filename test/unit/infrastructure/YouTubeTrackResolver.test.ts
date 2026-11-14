import { YtdlError, YtdlErrorCode } from '@distube/ytdl-core';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  InvalidTrackUrlError,
  NoAudioFormatError,
  TrackResolutionError,
  TrackUnavailableError,
} from '../../../src/application/errors.ts';
import {
  parseYouTubeVideoUrl,
  selectAudioFormat,
  YouTubeTrackResolver,
} from '../../../src/infrastructure/youtube/YouTubeTrackResolver.ts';
import { FakeYouTubeClient, makeFormat, makeVideoInfo } from '../../fixtures/youtube.ts';

const URL_OK = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
const request = { url: URL_OK, requestedBy: '42' };

describe('parseYouTubeVideoUrl', () => {
  it.each([
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://youtube.com/watch?v=dQw4w9WgXcQ&t=30',
    'https://m.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://youtu.be/dQw4w9WgXcQ?si=abc',
    'https://WWW.YouTube.com/watch?v=dQw4w9WgXcQ',
    '  https://www.youtube.com/shorts/dQw4w9WgXcQ  ',
  ])('accepts %s', (url) => {
    expect(parseYouTubeVideoUrl(url)).toBe('dQw4w9WgXcQ');
  });

  it.each([
    ['empty input', ''],
    ['not a URL', 'never gonna give you up'],
    ['http scheme', 'http://www.youtube.com/watch?v=dQw4w9WgXcQ'],
    ['unsupported host', 'https://music.youtube.com/watch?v=dQw4w9WgXcQ'],
    ['look-alike host', 'https://youtube.com.example.org/watch?v=dQw4w9WgXcQ'],
    ['other site', 'https://vimeo.com/123456'],
    ['playlist URL', 'https://www.youtube.com/playlist?list=PL1234567890'],
    ['missing video ID', 'https://youtu.be/'],
    ['malformed video ID', 'https://www.youtube.com/watch?v=short'],
  ])('rejects %s', (_, url) => {
    expect(() => parseYouTubeVideoUrl(url)).toThrow(InvalidTrackUrlError);
  });
});

describe('selectAudioFormat', () => {
  it('prefers audio-only, then Opus, then bitrate', () => {
    const muxed = makeFormat({ itag: 18, hasVideo: true, audioCodec: 'mp4a', audioBitrate: 320 });
    const aac = makeFormat({ itag: 140, audioCodec: 'mp4a.40.2', audioBitrate: 256 });
    const opusLow = makeFormat({ itag: 250, audioBitrate: 64 });
    const opusHigh = makeFormat({ itag: 251, audioBitrate: 160 });

    expect(selectAudioFormat([muxed, aac, opusLow, opusHigh]).itag).toBe(251);
    expect(selectAudioFormat([muxed, aac]).itag).toBe(140);
    expect(selectAudioFormat([muxed]).itag).toBe(18);
  });

  it('ignores formats without audio and DRM formats', () => {
    const formats = [
      makeFormat({ itag: 137, hasAudio: false, hasVideo: true, audioCodec: undefined }),
      makeFormat({ itag: 251, isDrm: true }),
    ];

    expect(() => selectAudioFormat(formats)).toThrow(NoAudioFormatError);
    expect(() => selectAudioFormat([])).toThrow(NoAudioFormatError);
  });

  it('treats an unknown bitrate as the lowest', () => {
    const unknown = makeFormat({ itag: 1, audioBitrate: undefined });
    const known = makeFormat({ itag: 2, audioBitrate: 48 });

    expect(selectAudioFormat([unknown, known]).itag).toBe(2);
  });
});

describe('YouTubeTrackResolver', () => {
  let client: FakeYouTubeClient;
  let resolver: YouTubeTrackResolver;

  beforeEach(() => {
    client = new FakeYouTubeClient();
    resolver = new YouTubeTrackResolver(client);
  });

  it('normalizes metadata into a track', async () => {
    const { track } = await resolver.resolve(
      { url: 'https://youtu.be/dQw4w9WgXcQ?t=3', requestedBy: '42' },
      AbortSignal.timeout(1000),
    );

    expect(track).toEqual({
      id: 'dQw4w9WgXcQ',
      title: 'Never Gonna Give You Up',
      url: URL_OK,
      artworkUrl: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
      durationMs: 213_000,
      requestedBy: '42',
    });
    expect(client.infoCalls[0]?.video).toBe('dQw4w9WgXcQ');
  });

  it('does not call YouTube for an invalid URL', async () => {
    await expect(
      resolver.resolve(
        { url: 'https://example.com', requestedBy: '42' },
        new AbortController().signal,
      ),
    ).rejects.toThrow(InvalidTrackUrlError);
    expect(client.infoCalls).toHaveLength(0);
  });

  it('tolerates missing thumbnails, title and duration', async () => {
    client.getInfoImpl = () =>
      Promise.resolve(
        makeVideoInfo({
          title: '  ',
          lengthSeconds: Number.NaN,
          thumbnails: [{ url: '//broken', width: 1, height: 1 }],
        }),
      );

    const { track } = await resolver.resolve(request, new AbortController().signal);

    expect(track.artworkUrl).toBeUndefined();
    expect(track.title).toBe('YouTube video dQw4w9WgXcQ');
    expect(track.durationMs).toBe(0);
  });

  it('rejects videos without an audio format', async () => {
    client.getInfoImpl = () => Promise.resolve(makeVideoInfo({ formats: [] }));

    await expect(resolver.resolve(request, new AbortController().signal)).rejects.toThrow(
      NoAudioFormatError,
    );
  });

  it.each([
    [YtdlErrorCode.NOT_FOUND, TrackUnavailableError],
    [YtdlErrorCode.PRIVATE, TrackUnavailableError],
    [YtdlErrorCode.AGE_RESTRICTED, TrackUnavailableError],
    [YtdlErrorCode.REGION_BLOCKED, TrackUnavailableError],
    [YtdlErrorCode.NO_FORMAT, NoAudioFormatError],
    [YtdlErrorCode.INVALID_URL, InvalidTrackUrlError],
    [YtdlErrorCode.BOT_CHECK, TrackResolutionError],
    [YtdlErrorCode.RATE_LIMITED, TrackResolutionError],
    [YtdlErrorCode.REQUEST_FAILED, TrackResolutionError],
  ])('maps %s to %o', async (code, expected) => {
    const cause = new YtdlError(code, 'upstream');
    client.getInfoImpl = () => Promise.reject(cause);

    const error: unknown = await resolver
      .resolve(request, new AbortController().signal)
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(expected);
    expect((error as Error).cause).toBe(cause);
  });

  it('wraps unexpected request failures', async () => {
    const cause = new TypeError('fetch failed');
    client.getInfoImpl = () => Promise.reject(cause);

    await expect(resolver.resolve(request, new AbortController().signal)).rejects.toMatchObject({
      name: 'TrackResolutionError',
      cause,
    });
  });

  it('propagates cancellation with the abort reason', async () => {
    const controller = new AbortController();
    const reason = new Error('stopped');
    client.getInfoImpl = (_, options) =>
      new Promise((_resolve, reject) => {
        options?.signal?.addEventListener('abort', () => {
          reject(new Error('aborted by client'));
        });
      });

    const pending = resolver.resolve(request, controller.signal);
    controller.abort(reason);

    await expect(pending).rejects.toBe(reason);
    expect(client.infoCalls[0]?.options?.signal).toBe(controller.signal);
  });

  it('opens a stream of the selected format on demand', async () => {
    const formats = [makeFormat({ itag: 140, audioCodec: 'mp4a' }), makeFormat({ itag: 251 })];
    client.getInfoImpl = () => Promise.resolve(makeVideoInfo({ formats }));
    const { source } = await resolver.resolve(request, new AbortController().signal);

    expect(client.downloads).toHaveLength(0);

    const streamController = new AbortController();
    const stream = source.open(streamController.signal);

    expect(client.downloads[0]?.options).toMatchObject({
      format: { itag: 251 },
      signal: streamController.signal,
    });
    streamController.abort();
    expect(stream.destroyed).toBe(true);
  });

  it('opens an independent stream per call', async () => {
    const { source } = await resolver.resolve(request, new AbortController().signal);

    const first = source.open(new AbortController().signal);
    const second = source.open(new AbortController().signal);

    expect(first).not.toBe(second);
    expect(client.downloads).toHaveLength(2);
  });
});
