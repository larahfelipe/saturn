import { PassThrough, Readable } from 'node:stream';
import { buffer } from 'node:stream/consumers';

import { createAudioResource, StreamType } from '@discordjs/voice';
import { describe, expect, it } from 'vitest';

import { AudioStreamError } from '../../src/application/errors.ts';
import { encodeOggOpus, verifyFfmpeg } from '../../src/infrastructure/audio/ffmpeg.ts';

/** These tests need a real FFmpeg build with libopus, and fail without one. */
const FFMPEG_PATH = process.env.FFMPEG_PATH ?? 'ffmpeg';

/** A 16-bit PCM WAV file holding a 440 Hz tone. */
function toneWav(seconds: number, sampleRate: number, channels: number): Buffer {
  const frames = seconds * sampleRate;
  const data = Buffer.alloc(frames * channels * 2);
  for (let frame = 0; frame < frames; frame++) {
    const sample = Math.round(Math.sin((2 * Math.PI * 440 * frame) / sampleRate) * 0.3 * 0x7fff);
    for (let channel = 0; channel < channels; channel++) {
      data.writeInt16LE(sample, (frame * channels + channel) * 2);
    }
  }
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVEfmt ', 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * channels * 2, 28);
  header.writeUInt16LE(channels * 2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

function encode(input: Readable, signal = new AbortController().signal) {
  return encodeOggOpus(input, { ffmpegPath: FFMPEG_PATH, bitrateKbps: 64, signal });
}

describe('FFmpeg', () => {
  it('has the libopus encoder', async () => {
    await expect(verifyFfmpeg(FFMPEG_PATH)).resolves.toBeUndefined();
  });

  it('encodes audio to 48 kHz stereo Ogg/Opus', async () => {
    const { output, completion } = encode(Readable.from([toneWav(2, 44_100, 1)]));

    const ogg = await buffer(output);
    await expect(completion).resolves.toBeUndefined();

    expect(ogg.subarray(0, 4).toString('latin1')).toBe('OggS');
    const head = ogg.indexOf('OpusHead');
    expect(head).toBeGreaterThan(0);
    expect(ogg.readUInt8(head + 9)).toBe(2);
    expect(ogg.readUInt32LE(head + 12)).toBe(48_000);
  });

  it('produces 20 ms Opus packets that @discordjs/voice can demux', async () => {
    const { output, completion } = encode(Readable.from([toneWav(2, 48_000, 2)]));
    const resource = createAudioResource(output, { inputType: StreamType.OggOpus });

    const packets: Buffer[] = [];
    for await (const packet of resource.playStream) packets.push(packet as Buffer);
    await expect(completion).resolves.toBeUndefined();

    expect(packets.length).toBeGreaterThanOrEqual(95);
    expect(packets.length).toBeLessThanOrEqual(110);
  });

  it('reports undecodable input', async () => {
    const { output, completion } = encode(Readable.from([Buffer.alloc(64 * 1024, 0x5a)]));
    output.resume();

    await expect(completion).rejects.toThrow(AudioStreamError);
    await expect(completion).rejects.toThrow(/^FFmpeg exited with code \d+: /);
  });

  it('is killed when playback is cancelled', async () => {
    const input = new PassThrough();
    input.write(toneWav(10, 48_000, 2));
    const controller = new AbortController();
    const { output, completion } = encode(input, controller.signal);
    output.resume();
    await new Promise((resolve) => output.once('data', resolve));

    const reason = new Error('skipped');
    controller.abort(reason);

    await expect(completion).rejects.toBe(reason);
    expect(input.destroyed).toBe(true);
  });
});
