import { readFile } from 'node:fs/promises';

import { Ytdl, YtdlError, YtdlErrorCode } from '@distube/ytdl-core';

import { SaturnError } from '../../shared/errors.ts';
import { YOUTUBE_REQUEST_TIMEOUT_MS } from './YouTubeTrackResolver.ts';

export class YouTubeCookieError extends SaturnError {}

export async function createYouTubeClient(cookieFile: string | undefined): Promise<Ytdl> {
  if (cookieFile === undefined) return new Ytdl({ timeoutMs: YOUTUBE_REQUEST_TIMEOUT_MS });

  const cookie = await readCookie(cookieFile);
  try {
    return new Ytdl({ cookie, timeoutMs: YOUTUBE_REQUEST_TIMEOUT_MS });
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
