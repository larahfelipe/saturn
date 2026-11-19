import { execFile, spawn } from 'node:child_process';
import type { Readable } from 'node:stream';
import { promisify } from 'node:util';

import { AudioStreamError } from '../../application/errors.ts';
import { SaturnError } from '../../shared/errors.ts';

const MIN_BITRATE_KBPS = 8;
const MAX_BITRATE_KBPS = 128;
const STDERR_LIMIT = 4096;

export interface OpusEncodeOptions {
  readonly bitrateKbps: number;
  readonly ffmpegPath: string;
  readonly signal: AbortSignal;
}

export interface OpusEncoding {
  readonly completion: Promise<void>;
  readonly output: Readable;
}

export class FfmpegUnavailableError extends SaturnError {}

export function encodeOggOpus(input: Readable, options: OpusEncodeOptions): OpusEncoding {
  const { signal } = options;
  const child = spawn(options.ffmpegPath, ffmpegArguments(options.bitrateKbps), {
    killSignal: 'SIGKILL',
    signal,
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  let inputError: unknown;
  input.on('error', (error) => {
    inputError ??= error;
    child.stdin.destroy();
  });
  child.stdin.on('error', () => undefined);
  input.pipe(child.stdin);

  let stderr = '';
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk: string) => {
    stderr = (stderr + chunk).slice(-STDERR_LIMIT);
  });

  let spawnError: Error | undefined;
  child.once('error', (error) => {
    if (child.pid === undefined) spawnError = error;
  });
  const exited = new Promise<[number | null, NodeJS.Signals | null]>((resolve) => {
    child.once('close', (code, exitSignal) => {
      input.destroy();
      resolve([code, exitSignal]);
    });
  });

  const completion = exited.then(([code, exitSignal]) => {
    signal.throwIfAborted();
    if (spawnError !== undefined) {
      throw new AudioStreamError('FFmpeg could not be started', { cause: spawnError });
    }
    if (inputError !== undefined) {
      throw new AudioStreamError('Audio source stream failed', { cause: inputError });
    }
    if (code === 0) return;
    const detail = stderr.trim().split('\n').at(-1) ?? '';
    const status = exitSignal === null ? `code ${code}` : `signal ${exitSignal}`;
    throw new AudioStreamError(`FFmpeg exited with ${status}${detail && `: ${detail}`}`);
  });
  completion.catch(() => undefined);

  const release = (): void => {
    input.destroy();
  };
  if (signal.aborted) release();
  else signal.addEventListener('abort', release, { once: true });

  return { completion, output: child.stdout };
}

export function ffmpegArguments(bitrateKbps: number): string[] {
  return [
    ['-hide_banner', '-loglevel', 'error'],
    ['-i', 'pipe:0', '-vn'],
    ['-c:a', 'libopus', '-b:a', `${bitrateKbps}k`, '-ar', '48000', '-ac', '2'],
    ['-f', 'ogg', 'pipe:1'],
  ].flat();
}

export function opusBitrateKbps(channelBitrate: number): number {
  const kbps = Math.floor(channelBitrate / 1000);
  return Math.min(MAX_BITRATE_KBPS, Math.max(MIN_BITRATE_KBPS, kbps));
}

export async function verifyFfmpeg(ffmpegPath: string): Promise<void> {
  let encoders: string;
  try {
    ({ stdout: encoders } = await promisify(execFile)(ffmpegPath, ['-hide_banner', '-encoders'], {
      timeout: 10_000,
    }));
  } catch (error) {
    throw new FfmpegUnavailableError(`FFmpeg is not available at "${ffmpegPath}"`, {
      cause: error,
    });
  }
  if (!/^\s*A\S*\s+libopus\s/m.test(encoders)) {
    throw new FfmpegUnavailableError('FFmpeg was built without the libopus encoder');
  }
}
