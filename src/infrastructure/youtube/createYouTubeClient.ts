import { readFile } from 'node:fs/promises';

import { Ytdl, YtdlError, YtdlErrorCode } from '@distube/ytdl-core';

import { SaturnError } from '../../shared/errors.ts';
import { YOUTUBE_REQUEST_TIMEOUT_MS } from './YouTubeTrackResolver.ts';

export class YouTubeCookieError extends SaturnError {}

const WATCH_NEXT_URL = 'https://www.youtube.com/youtubei/v1/next';

export async function createYouTubeClient(cookieFile: string | undefined): Promise<Ytdl> {
  const options = { fetch: fetchWithoutWatchNext, timeoutMs: YOUTUBE_REQUEST_TIMEOUT_MS };
  if (cookieFile === undefined) return new Ytdl(options);

  const cookie = await readCookie(cookieFile);
  try {
    return new Ytdl({ ...options, cookie });
  } catch (error) {
    if (!YtdlError.is(error, YtdlErrorCode.INVALID_ARGUMENT)) throw error;
    throw invalidCookieFile(
      'holds no signed-in YouTube session (no SAPISID or __Secure-3PAPISID cookie)',
    );
  }
}

function errorCode(error: unknown): string {
  return error instanceof Error && 'code' in error && typeof error.code === 'string'
    ? error.code
    : 'unknown error';
}

/**
 * Every lookup also asks YouTube's `next` endpoint, only for related videos,
 * likes and chapters, and reads a failed answer as empty. Saturn uses none of
 * them, so answering it locally saves a request of up to a second per song.
 */
function fetchWithoutWatchNext(
  input: Request | string | URL,
  init?: RequestInit,
): Promise<Response> {
  const url = new URL(input instanceof Request ? input.url : input);
  return `${url.origin}${url.pathname}` === WATCH_NEXT_URL
    ? Promise.resolve(Response.json({}))
    : fetch(input, init);
}

function invalidCookieFile(problem: string): YouTubeCookieError {
  return new YouTubeCookieError(`YOUTUBE_COOKIE_FILE ${problem}`);
}

async function readCookie(path: string): Promise<string> {
  let text: string;
  try {
    text = await readFile(path, 'utf8');
  } catch (error) {
    throw invalidCookieFile(`could not be read (${errorCode(error)})`);
  }
  const cookie = text.trim().replace(/^cookie:\s*/i, '');
  if (cookie.length === 0) throw invalidCookieFile('is empty');
  return cookie;
}
