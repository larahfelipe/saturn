import { PassThrough, Readable } from 'node:stream';
import { buffer } from 'node:stream/consumers';

import { describe, expect, it } from 'vitest';

import { AudioStreamError } from '../../../src/application/errors.ts';
import {
  encodeOggOpus,
  FfmpegUnavailableError,
  verifyFfmpeg,
} from '../../../src/infrastructure/audio/ffmpeg.ts';
import { fakeFfmpeg } from '../../fixtures/audio.ts';

function encode(ffmpegPath: string, input: Readable, signal = new AbortController().signal) {
  return encodeOggOpus(input, { ffmpegPath, bitrateKbps: 64, signal });
}

describe('encodeOggOpus', () => {
  it('streams the encoder output and resolves on a clean exit', async () => {
    const audio = Buffer.from('encoded audio bytes'.repeat(1000));
    const { output, completion } = encode(fakeFfmpeg('passthrough'), Readable.from([audio]));

    await expect(buffer(output)).resolves.toEqual(audio);
    await expect(completion).resolves.toBeUndefined();
  });

  it('reports the exit status and last diagnostic line when FFmpeg fails', async () => {
    const input = new PassThrough();
    const { completion } = encode(fakeFfmpeg('failing'), input);

    await expect(completion).rejects.toThrow(
      new AudioStreamError(
        'FFmpeg exited with code 1: pipe:0: Invalid data found when processing input',
      ),
    );
  });

  it('blames FFmpeg, not the input, when FFmpeg exits before reading all input', async () => {
    const input = new PassThrough();
    input.write('some audio');
    const { completion } = encode(fakeFfmpeg('failing'), input);

    await expect(completion).rejects.toThrow(/^FFmpeg exited with code 1: /);
    expect(input.destroyed).toBe(true);
  });

  it('kills FFmpeg and releases the input when aborted', async () => {
    const input = new PassThrough();
    const controller = new AbortController();
    const { output, completion } = encode(fakeFfmpeg('stalled'), input, controller.signal);
    input.write('some audio');
    output.resume();

    const reason = new Error('skipped');
    controller.abort(reason);

    await expect(completion).rejects.toBe(reason);
    expect(input.destroyed).toBe(true);
  });

  it('does not run when the signal is already aborted', async () => {
    const input = new PassThrough();
    const reason = new Error('stopped');

    const { completion } = encode(fakeFfmpeg('stalled'), input, AbortSignal.abort(reason));

    await expect(completion).rejects.toBe(reason);
    expect(input.destroyed).toBe(true);
  });

  it('fails when the source stream fails, even if FFmpeg exits cleanly', async () => {
    const input = new PassThrough();
    const { output, completion } = encode(fakeFfmpeg('passthrough'), input);
    output.resume();
    const cause = new Error('connection reset');

    input.write('partial audio');
    input.destroy(cause);

    const error: unknown = await completion.catch((error: unknown) => error);
    expect(error).toBeInstanceOf(AudioStreamError);
    expect(error).toMatchObject({ message: 'Audio source stream failed', cause });
  });

  it('fails when FFmpeg cannot be started', async () => {
    const { completion } = encode('/nonexistent/ffmpeg', new PassThrough());

    await expect(completion).rejects.toThrow(new AudioStreamError('FFmpeg could not be started'));
  });
});

describe('verifyFfmpeg', () => {
  it('accepts an FFmpeg build with libopus', async () => {
    await expect(verifyFfmpeg(fakeFfmpeg('passthrough'))).resolves.toBeUndefined();
  });

  it('rejects an FFmpeg build without libopus', async () => {
    await expect(verifyFfmpeg(fakeFfmpeg('no-opus'))).rejects.toThrow(
      new FfmpegUnavailableError('FFmpeg was built without the libopus encoder'),
    );
  });

  it('rejects a missing or failing executable', async () => {
    await expect(verifyFfmpeg('/nonexistent/ffmpeg')).rejects.toThrow(FfmpegUnavailableError);
    await expect(verifyFfmpeg(fakeFfmpeg('failing'))).rejects.toThrow(FfmpegUnavailableError);
  });
});
