import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { Ytdl } from '@distube/ytdl-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createYouTubeClient,
  YouTubeCookieError,
} from '../../../../src/infrastructure/youtube/createYouTubeClient.ts';
import { YouTubeTrackResolver } from '../../../../src/infrastructure/youtube/YouTubeTrackResolver.ts';

const SAPISID = 'placeholder-sapisid-value';
const SESSION = 'placeholder-session-value';

function netscapeLine(domain: string, name: string, value: string): string {
  return [domain, 'TRUE', '/', 'TRUE', '1893456000', name, value].join('\t');
}

const VIDEO_ID = 'dQw4w9WgXcQ';
const ARTWORK_URL = `https://i.ytimg.com/vi/${VIDEO_ID}/maxresdefault.jpg`;
const PLAYER_RESPONSE = {
  microformat: { playerMicroformatRenderer: {} },
  playabilityStatus: { status: 'OK' },
  streamingData: {
    adaptiveFormats: [
      {
        bitrate: 130_000,
        itag: 251,
        mimeType: 'audio/webm; codecs="opus"',
        url: 'https://rr1---sn.googlevideo.com/videoplayback?itag=251',
      },
    ],
  },
  videoDetails: {
    lengthSeconds: '213',
    thumbnail: { thumbnails: [{ height: 720, url: ARTWORK_URL, width: 1280 }] },
    title: 'Never Gonna Give You Up',
    videoId: VIDEO_ID,
  },
};

function visitorDataPage(): string {
  const entry: (string | null)[] = Array.from({ length: 14 }, () => null);
  entry[13] = 'placeholder-visitor-data';
  return `)]}'\n${JSON.stringify([[null, null, [[entry]]]])}`;
}

function youTubeFake(requests: string[]): typeof fetch {
  return (input, init) => {
    const url = new URL(input instanceof Request ? input.url : input);
    const request = `${init?.method ?? 'GET'} ${url.origin}${url.pathname}`;
    requests.push(request);
    if (request === 'GET https://www.youtube.com/sw.js_data') {
      return Promise.resolve(new Response(visitorDataPage()));
    }
    if (request === 'POST https://www.youtube.com/youtubei/v1/player') {
      return Promise.resolve(Response.json(PLAYER_RESPONSE));
    }
    return Promise.resolve(new Response(undefined, { status: 404 }));
  };
}

const SIGNED_IN_EXPORT = [
  '# Netscape HTTP Cookie File',
  netscapeLine('.youtube.com', 'SAPISID', SAPISID),
  `#HttpOnly_${netscapeLine('.youtube.com', '__Secure-3PSID', SESSION)}`,
  netscapeLine('.google.com', 'NID', 'placeholder-unrelated-value'),
  '',
].join('\n');

describe(createYouTubeClient, () => {
  let directory: string;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'saturn-cookie-'));
  });

  afterEach(async () => {
    await rm(directory, { force: true, recursive: true });
  });

  async function cookieFile(content: string): Promise<string> {
    const path = join(directory, 'youtube-cookies.txt');
    await writeFile(path, content);
    return path;
  }

  async function rejection(path: string): Promise<string> {
    const error: unknown = await createYouTubeClient(path).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(YouTubeCookieError);
    const { message } = error as Error;
    expect(message).not.toContain(directory);
    expect(message).not.toContain(SAPISID);
    expect(message).not.toContain(SESSION);
    return message;
  }

  it('creates a signed-out client without a cookie file', async () => {
    await expect(createYouTubeClient(undefined)).resolves.toBeInstanceOf(Ytdl);
  });

  it('signs in with a Netscape cookie export', async () => {
    const path = await cookieFile(SIGNED_IN_EXPORT);

    await expect(createYouTubeClient(path)).resolves.toBeInstanceOf(Ytdl);
  });

  it.each([
    ['a Cookie header', `SAPISID=${SAPISID}; SID=${SESSION}\n`],
    ['a Cookie header copied with its name', `Cookie: SAPISID=${SAPISID}; SID=${SESSION}\n`],
  ])('signs in with %s', async (_, header) => {
    const path = await cookieFile(header);

    await expect(createYouTubeClient(path)).resolves.toBeInstanceOf(Ytdl);
  });

  it.each([
    ['a signed-out header', `PREF=f6=40000000; SID=${SESSION}`],
    ['an export without YouTube session cookies', SIGNED_IN_EXPORT.replace('SAPISID', 'PREF')],
    [
      'an export whose session belongs to another domain',
      netscapeLine('.google.com', 'SAPISID', SAPISID),
    ],
  ])('refuses %s without revealing it', async (_, content) => {
    await expect(rejection(await cookieFile(content))).resolves.toBe(
      'YOUTUBE_COOKIE_FILE holds no signed-in YouTube session (no SAPISID or __Secure-3PAPISID cookie)',
    );
  });

  it.each(['', ' \n\t\n', 'Cookie:\n'])('refuses an empty file (%j)', async (content) => {
    await expect(rejection(await cookieFile(content))).resolves.toBe(
      'YOUTUBE_COOKIE_FILE is empty',
    );
  });

  it('refuses a missing file without revealing its path', async () => {
    await expect(rejection(join(directory, 'missing.txt'))).resolves.toBe(
      'YOUTUBE_COOKIE_FILE could not be read (ENOENT)',
    );
  });

  it('refuses a directory', async () => {
    const path = join(directory, 'cookies');
    await mkdir(path);

    await expect(rejection(path)).resolves.toBe('YOUTUBE_COOKIE_FILE could not be read (EISDIR)');
  });

  describe('lookups', () => {
    let requests: string[];

    beforeEach(() => {
      requests = [];
      vi.stubGlobal('fetch', youTubeFake(requests));
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it.each([
      ['signed out', () => Promise.resolve(undefined)],
      ['signed in', () => cookieFile(SIGNED_IN_EXPORT)],
    ])('resolves a track %s without asking YouTube for related videos', async (_, cookiePath) => {
      const client = await createYouTubeClient(await cookiePath());

      const { track } = await new YouTubeTrackResolver(client).resolve(
        { requestedBy: '42', url: `https://www.youtube.com/watch?v=${VIDEO_ID}` },
        AbortSignal.timeout(5000),
      );

      expect(track).toMatchObject({
        artworkUrl: ARTWORK_URL,
        durationMs: 213_000,
        title: 'Never Gonna Give You Up',
      });
      expect(requests).toEqual([
        'GET https://www.youtube.com/sw.js_data',
        'POST https://www.youtube.com/youtubei/v1/player',
      ]);
    });
  });
});
