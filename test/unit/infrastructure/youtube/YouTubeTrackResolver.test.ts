import { YtdlError, YtdlErrorCode } from '@distube/ytdl-core';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  InvalidTrackUrlError,
  NoAudioFormatError,
  TrackResolutionError,
  TrackUnavailableError,
} from '../../../../src/application/errors.ts';
import {
  parseYouTubeVideoUrl,
  READ_AHEAD_BYTES,
  selectAudioFormat,
  YouTubeTrackResolver,
} from '../../../../src/infrastructure/youtube/YouTubeTrackResolver.ts';
import { FakeYouTubeClient, makeFormat, makeVideoInfo } from '../../../fixtures/youtube.ts';

const URL_OK = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
const REQUEST = { requestedBy: '42', url: URL_OK };

describe(parseYouTubeVideoUrl, () => {
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
    // eslint-disable-next-line unicorn/prefer-https -- rejecting plain HTTP is the behavior under test
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

describe(selectAudioFormat, () => {
  it('prefers audio-only, then Opus, then bitrate', () => {
    const muxed = makeFormat({ audioBitrate: 320, audioCodec: 'mp4a', hasVideo: true, itag: 18 });
    const aac = makeFormat({ audioBitrate: 256, audioCodec: 'mp4a.40.2', itag: 140 });
    const opusLow = makeFormat({ audioBitrate: 64, itag: 250 });
    const opusHigh = makeFormat({ audioBitrate: 160, itag: 251 });

    expect(selectAudioFormat([muxed, aac, opusLow, opusHigh]).itag).toBe(251);
    expect(selectAudioFormat([muxed, aac]).itag).toBe(140);
    expect(selectAudioFormat([muxed]).itag).toBe(18);
  });

  it('ignores formats without audio and DRM formats', () => {
    const formats = [
      makeFormat({ audioCodec: undefined, hasAudio: false, hasVideo: true, itag: 137 }),
      makeFormat({ isDrm: true, itag: 251 }),
    ];

    expect(() => selectAudioFormat(formats)).toThrow(NoAudioFormatError);
    expect(() => selectAudioFormat([])).toThrow(NoAudioFormatError);
  });

  it('treats an unknown bitrate as the lowest', () => {
    const unknown = makeFormat({ audioBitrate: undefined, itag: 1 });
    const known = makeFormat({ audioBitrate: 48, itag: 2 });

    expect(selectAudioFormat([unknown, known]).itag).toBe(2);
  });
});

describe(YouTubeTrackResolver, () => {
  let client: FakeYouTubeClient;
  let resolver: YouTubeTrackResolver;

  beforeEach(() => {
    client = new FakeYouTubeClient();
    resolver = new YouTubeTrackResolver(client);
  });

  it('normalizes metadata into a track', async () => {
    const { track } = await resolver.resolve(
      { requestedBy: '42', url: 'https://youtu.be/dQw4w9WgXcQ?t=3' },
      AbortSignal.timeout(1000),
    );

    expect(track).toEqual({
      artworkUrl: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
      durationMs: 213_000,
      id: 'dQw4w9WgXcQ',
      requestedBy: '42',
      title: 'Never Gonna Give You Up',
      url: URL_OK,
    });
    expect(client.infoCalls[0]?.video).toBe('dQw4w9WgXcQ');
  });

  it('refuses an invalid URL at once without calling YouTube', () => {
    expect(() =>
      resolver.resolve(
        { requestedBy: '42', url: 'https://example.com' },
        new AbortController().signal,
      ),
    ).toThrow(InvalidTrackUrlError);
    expect(client.infoCalls).toHaveLength(0);
  });

  it('tolerates missing thumbnails, title and duration', async () => {
    client.getInfoImpl = () =>
      Promise.resolve(
        makeVideoInfo({
          lengthSeconds: NaN,
          thumbnails: [{ height: 1, url: '//broken', width: 1 }],
          title: '  ',
        }),
      );

    const { track } = await resolver.resolve(REQUEST, new AbortController().signal);

    expect(track.artworkUrl).toBeUndefined();
    expect(track.title).toBe('YouTube video dQw4w9WgXcQ');
    expect(track.durationMs).toBe(0);
  });

  it('rejects videos without an audio format', async () => {
    client.getInfoImpl = () => Promise.resolve(makeVideoInfo({ formats: [] }));

    await expect(resolver.resolve(REQUEST, new AbortController().signal)).rejects.toThrow(
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
      .resolve(REQUEST, new AbortController().signal)
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(expected);
    expect((error as Error).cause).toBe(cause);
  });

  it.each([YtdlErrorCode.BOT_CHECK, YtdlErrorCode.AGE_RESTRICTED])(
    'reports a rejected cookie behind %s',
    async (code) => {
      const cause = new YtdlError(code, 'upstream', {
        attempts: [
          { client: 'visionos', code, reason: 'refused', signedIn: false, step: 'playability' },
          {
            client: 'tv',
            code: YtdlErrorCode.AUTH_FAILED,
            reason: 'treated as logged out',
            signedIn: true,
            step: 'playability',
          },
        ],
      });
      client.getInfoImpl = () => Promise.reject(cause);

      const error: unknown = await resolver
        .resolve(REQUEST, new AbortController().signal)
        .catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(TrackResolutionError);
      expect((error as Error).message).toBe('Track resolution failed: AUTH_FAILED');
      expect((error as Error).cause).toBe(cause);
    },
  );

  it('wraps unexpected REQUEST failures', async () => {
    const cause = new TypeError('fetch failed');
    client.getInfoImpl = () => Promise.reject(cause);

    await expect(resolver.resolve(REQUEST, new AbortController().signal)).rejects.toMatchObject({
      cause,
      name: 'TrackResolutionError',
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

    const pending = resolver.resolve(REQUEST, controller.signal);
    controller.abort(reason);

    await expect(pending).rejects.toBe(reason);
    expect(client.infoCalls[0]?.options?.signal?.aborted).toBe(true);
  });

  it('gives up on a lookup that exceeds the deadline', async () => {
    resolver = new YouTubeTrackResolver(client, { timeoutMs: 20 });
    client.getInfoImpl = (_, options) =>
      new Promise((_resolve, reject) => {
        options?.signal?.addEventListener('abort', () => {
          reject(new Error('aborted by client'));
        });
      });

    await expect(resolver.resolve(REQUEST, new AbortController().signal)).rejects.toMatchObject({
      name: 'TrackResolutionError',
      reason: 'timed out',
    });
  });

  it('opens a stream of the selected format on demand', async () => {
    const formats = [makeFormat({ audioCodec: 'mp4a', itag: 140 }), makeFormat({ itag: 251 })];
    client.getInfoImpl = () => Promise.resolve(makeVideoInfo({ formats }));
    const { source } = await resolver.resolve(REQUEST, new AbortController().signal);

    expect(client.downloads).toHaveLength(0);

    const streamController = new AbortController();
    const stream = source.open(streamController.signal);

    expect(client.downloads[0]?.options).toMatchObject({
      format: { itag: 251 },
      highWaterMark: READ_AHEAD_BYTES,
      signal: streamController.signal,
    });
    streamController.abort();
    expect(stream.destroyed).toBe(true);
  });

  it('opens an independent stream per call', async () => {
    const { source } = await resolver.resolve(REQUEST, new AbortController().signal);

    const first = source.open(new AbortController().signal);
    const second = source.open(new AbortController().signal);

    expect(first).not.toBe(second);
    expect(client.downloads).toHaveLength(2);
  });
});
