import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { Ytdl } from '@distube/ytdl-core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  createYouTubeClient,
  YouTubeCookieError,
} from '../../../src/infrastructure/youtube/createYouTubeClient.ts';

const SAPISID = 'placeholder-sapisid-value';
const SESSION = 'placeholder-session-value';

function netscapeLine(domain: string, name: string, value: string): string {
  return [domain, 'TRUE', '/', 'TRUE', '1893456000', name, value].join('\t');
}

const SIGNED_IN_EXPORT = [
  '# Netscape HTTP Cookie File',
  netscapeLine('.youtube.com', 'SAPISID', SAPISID),
  `#HttpOnly_${netscapeLine('.youtube.com', '__Secure-3PSID', SESSION)}`,
  netscapeLine('.google.com', 'NID', 'placeholder-unrelated-value'),
  '',
].join('\n');

describe('createYouTubeClient', () => {
  let directory: string;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'saturn-cookie-'));
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
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
    expect(await rejection(await cookieFile(content))).toBe(
      'YOUTUBE_COOKIE_FILE holds no signed-in YouTube session (no SAPISID or __Secure-3PAPISID cookie)',
    );
  });

  it.each(['', ' \n\t\n', 'Cookie:\n'])('refuses an empty file (%j)', async (content) => {
    expect(await rejection(await cookieFile(content))).toBe('YOUTUBE_COOKIE_FILE is empty');
  });

  it('refuses a missing file without revealing its path', async () => {
    expect(await rejection(join(directory, 'missing.txt'))).toBe(
      'YOUTUBE_COOKIE_FILE could not be read (ENOENT)',
    );
  });

  it('refuses a directory', async () => {
    const path = join(directory, 'cookies');
    await mkdir(path);

    expect(await rejection(path)).toBe('YOUTUBE_COOKIE_FILE could not be read (EISDIR)');
  });
});
