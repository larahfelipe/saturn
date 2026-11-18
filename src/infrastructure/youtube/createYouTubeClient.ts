import { readFile } from 'node:fs/promises';

import { Ytdl, YtdlError, YtdlErrorCode } from '@distube/ytdl-core';

import { SaturnError } from '../../shared/errors.ts';
import { YOUTUBE_REQUEST_TIMEOUT_MS } from './YouTubeTrackResolver.ts';

/** The cookie file is unusable. The message names YOUTUBE_COOKIE_FILE, never its path or content. */
export class YouTubeCookieError extends SaturnError {}

/**
 * The ytdl instance behind every lookup, signed in to YouTube when `cookieFile`
 * names a file holding a session's `Cookie` header or Netscape cookie export.
 *
 * @throws YouTubeCookieError when the file cannot be read or holds no signed-in session.
 */
export async function createYouTubeClient(cookieFile: string | undefined): Promise<Ytdl> {
  if (cookieFile === undefined) return new Ytdl({ timeoutMs: YOUTUBE_REQUEST_TIMEOUT_MS });

  const cookie = await readCookie(cookieFile);
  try {
    return new Ytdl({ timeoutMs: YOUTUBE_REQUEST_TIMEOUT_MS, cookie });
  } catch (error) {
    if (!YtdlError.is(error, YtdlErrorCode.INVALID_ARGUMENT)) throw error;
    throw invalidCookieFile(
      'holds no signed-in YouTube session (no SAPISID or __Secure-3PAPISID cookie)',
    );
  }
}

async function readCookie(path: string): Promise<string> {
  let text: string;
  try {
    text = await readFile(path, 'utf8');
  } catch (error) {
    throw invalidCookieFile(`could not be read (${errorCode(error)})`);
  }
  // Copying the header from browser developer tools can include its name.
  const cookie = text.trim().replace(/^cookie:\s*/i, '');
  if (cookie.length === 0) throw invalidCookieFile('is empty');
  return cookie;
}

function invalidCookieFile(problem: string): YouTubeCookieError {
  return new YouTubeCookieError(`YOUTUBE_COOKIE_FILE ${problem}`);
}

function errorCode(error: unknown): string {
  return error instanceof Error && 'code' in error && typeof error.code === 'string'
    ? error.code
    : 'unknown error';
}
