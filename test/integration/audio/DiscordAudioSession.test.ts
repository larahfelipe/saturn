import { setTimeout as sleep } from 'node:timers/promises';

import {
  AudioPlayerStatus,
  createAudioPlayer,
  entersState,
  NoSubscriberBehavior,
  VoiceConnectionDisconnectReason,
  VoiceConnectionStatus,
  type AudioPlayer,
} from '@discordjs/voice';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AudioStreamError, VoiceConnectionError } from '../../../src/application/errors.ts';
import { DiscordAudioSession } from '../../../src/infrastructure/audio/DiscordAudioSession.ts';
import { fakeFfmpeg, oggOpus, oggOpusHeaders, type FakeFfmpeg } from '../../fixtures/audio.ts';
import { RecordingLogger } from '../../fixtures/fakes.ts';
import { FakeVoiceConnection, StreamSource } from '../../fixtures/voice.ts';

const RECONNECT_TIMEOUT_MS = 50;
const READY_TIMEOUT_MS = 100;
const REJOIN_DELAY_MS = 10;
const START_TIMEOUT_MS = 200;

describe('DiscordAudioSession', () => {
  let connection: FakeVoiceConnection;
  let player: AudioPlayer;
  let statuses: AudioPlayerStatus[];
  let lost: Error[];
  let sessions: DiscordAudioSession[];
  let logger: RecordingLogger;

  function createSession(ffmpeg: FakeFfmpeg = 'passthrough'): DiscordAudioSession {
    const session = new DiscordAudioSession({
      connection: connection.asConnection(),
      player,
      ffmpegPath: fakeFfmpeg(ffmpeg),
      bitrateKbps: 64,
      logger,
      onLost: (error) => lost.push(error),
      reconnectTimeoutMs: RECONNECT_TIMEOUT_MS,
      readyTimeoutMs: READY_TIMEOUT_MS,
      rejoinDelayMs: REJOIN_DELAY_MS,
      startTimeoutMs: START_TIMEOUT_MS,
    });
    sessions.push(session);
    return session;
  }

  beforeEach(() => {
    connection = new FakeVoiceConnection();
    connection.setStatus(VoiceConnectionStatus.Ready);
    // No real connection subscribes, so let the player consume frames anyway.
    player = createAudioPlayer({
      behaviors: { noSubscriber: NoSubscriberBehavior.Play, maxMissedFrames: 5 },
    });
    statuses = [];
    player.on('stateChange', (_, next) => statuses.push(next.status));
    lost = [];
    sessions = [];
    logger = new RecordingLogger();
  });

  afterEach(() => {
    for (const session of sessions) session.destroy();
    player.stop(true);
  });

  describe('playback', () => {
    it('plays a track until its stream ends', async () => {
      const session = createSession();
      const source = new StreamSource(oggOpus(10));

      await session.play(source, new AbortController().signal);

      expect(statuses).toEqual([
        AudioPlayerStatus.Buffering,
        AudioPlayerStatus.Playing,
        AudioPlayerStatus.Idle,
      ]);
      expect(source.stream?.destroyed).toBe(true);
      expect(source.signals[0]?.aborted).toBe(true);
    });

    it('plays consecutive tracks on the same connection', async () => {
      const session = createSession();
      const signal = new AbortController().signal;

      await session.play(new StreamSource(oggOpus(5)), signal);
      await session.play(new StreamSource(oggOpus(5)), signal);

      expect(statuses.filter((status) => status === AudioPlayerStatus.Playing)).toHaveLength(2);
      expect(connection.subscriptions).toHaveLength(1);
    });

    it('pauses and resumes the current track', async () => {
      const session = createSession();
      const playback = session.play(new StreamSource(oggOpus(15)), new AbortController().signal);
      await entersState(player, AudioPlayerStatus.Playing, 2000);

      session.pause();
      expect(player.state.status).toBe(AudioPlayerStatus.Paused);
      await sleep(400);
      expect(player.state.status).toBe(AudioPlayerStatus.Paused);

      session.resume();
      expect(player.state.status).toBe(AudioPlayerStatus.Playing);
      await expect(playback).resolves.toBeUndefined();
    });

    it('applies a pause requested before the track starts playing', async () => {
      const session = createSession();
      const playback = session.play(new StreamSource(oggOpus(10)), new AbortController().signal);

      session.pause();
      await entersState(player, AudioPlayerStatus.Paused, 2000);

      session.resume();
      await expect(playback).resolves.toBeUndefined();
    });

    it('starts the next track unpaused', async () => {
      const session = createSession();
      const controller = new AbortController();
      const first = session.play(new StreamSource(oggOpus(500)), controller.signal);
      await entersState(player, AudioPlayerStatus.Playing, 2000);
      session.pause();
      controller.abort();
      await first;

      await session.play(new StreamSource(oggOpus(5)), new AbortController().signal);

      expect(statuses.at(-2)).toBe(AudioPlayerStatus.Playing);
    });

    it('rejects a second concurrent track', async () => {
      const session = createSession();
      const controller = new AbortController();
      const first = session.play(new StreamSource(oggOpus(500)), controller.signal);

      await expect(session.play(new StreamSource(oggOpus(5)), controller.signal)).rejects.toThrow(
        new AudioStreamError('A track is already playing'),
      );
      controller.abort();
      await first;
    });
  });

  describe('cancellation', () => {
    it('stops playback and releases the stream when aborted', async () => {
      const session = createSession();
      const controller = new AbortController();
      const source = new StreamSource(oggOpus(500));
      const playback = session.play(source, controller.signal);
      await entersState(player, AudioPlayerStatus.Playing, 2000);

      controller.abort();

      await expect(playback).resolves.toBeUndefined();
      expect(player.state.status).toBe(AudioPlayerStatus.Idle);
      expect(source.stream?.destroyed).toBe(true);
      expect(source.signals[0]?.aborted).toBe(true);
    });

    it('does not open the source when already aborted', async () => {
      const session = createSession();
      const source = new StreamSource(oggOpus(5));

      await session.play(source, AbortSignal.abort());

      expect(source.streams).toHaveLength(0);
      expect(statuses).toEqual([]);
    });
  });

  describe('stream failures', () => {
    it('rejects when FFmpeg fails', async () => {
      const session = createSession('failing');
      const source = new StreamSource(oggOpus(50), { end: false });

      await expect(session.play(source, new AbortController().signal)).rejects.toThrow(
        AudioStreamError,
      );
      expect(player.state.status).toBe(AudioPlayerStatus.Idle);
      expect(source.stream?.destroyed).toBe(true);
    });

    it('rejects when the source stream fails mid-track', async () => {
      const session = createSession();
      const source = new StreamSource(oggOpus(500).subarray(0, 600), { end: false });
      const playback = session.play(source, new AbortController().signal);

      source.stream?.destroy(new Error('connection reset'));

      await expect(playback).rejects.toThrow(new AudioStreamError('Audio source stream failed'));
      expect(player.state.status).toBe(AudioPlayerStatus.Idle);
    });

    it('rejects when the stream stops delivering audio', async () => {
      const session = createSession();
      const source = new StreamSource(oggOpusHeaders(), { end: false });
      const playback = session.play(source, new AbortController().signal);
      source.stream?.write(oggOpus(5).subarray(oggOpusHeaders().length));

      await expect(playback).rejects.toThrow(new AudioStreamError('Audio stream stalled'));
      expect(source.stream?.destroyed).toBe(true);
    });

    it('rejects when the stream delivers no audio before the start deadline', async () => {
      const session = createSession();
      const source = new StreamSource(Buffer.alloc(0), { end: false });

      await expect(session.play(source, new AbortController().signal)).rejects.toThrow(
        new AudioStreamError('Audio stream did not start'),
      );
      expect(player.state.status).toBe(AudioPlayerStatus.Idle);
      expect(source.stream?.destroyed).toBe(true);
    });

    it('keeps playing past the start deadline once audio arrived', async () => {
      const session = createSession();
      const source = new StreamSource(oggOpus(25));

      await expect(session.play(source, new AbortController().signal)).resolves.toBeUndefined();
    });

    it('rejects when the audio cannot be demuxed', async () => {
      const session = createSession();
      const source = new StreamSource(Buffer.alloc(4096, 1));

      await expect(session.play(source, new AbortController().signal)).rejects.toThrow(
        new AudioStreamError('Audio playback failed'),
      );
    });
  });

  describe('destroy', () => {
    it('ends playback, unsubscribes and disconnects once', async () => {
      const session = createSession();
      const playback = session.play(new StreamSource(oggOpus(500)), new AbortController().signal);
      await entersState(player, AudioPlayerStatus.Playing, 2000);

      session.destroy();
      session.destroy();

      await expect(playback).resolves.toBeUndefined();
      expect(player.state.status).toBe(AudioPlayerStatus.Idle);
      expect(connection.subscriptions[0]?.unsubscribed).toBe(true);
      expect(connection.destroyCount).toBe(1);
      expect(lost).toEqual([]);
      await expect(
        session.play(new StreamSource(oggOpus(5)), new AbortController().signal),
      ).rejects.toThrow(VoiceConnectionError);
    });

    it('refuses a connection that is already destroyed', () => {
      connection.destroy();

      expect(() => createSession()).toThrow(VoiceConnectionError);
    });
  });

  describe('connection recovery', () => {
    const closedByDiscord = {
      reason: VoiceConnectionDisconnectReason.WebSocketClose,
      closeCode: 4014,
    };
    const gatewayUnavailable = { reason: VoiceConnectionDisconnectReason.AdapterUnavailable };

    /** Lower bounds only: timers never fire early, but may fire late under load. */
    function expectGrowingGaps(times: readonly number[]): void {
      times.slice(1).forEach((time, index) => {
        expect(time - (times[index] ?? 0)).toBeGreaterThanOrEqual(
          (index + 2) * REJOIN_DELAY_MS - 2,
        );
      });
    }

    it('keeps the session when Discord moves it to another channel', async () => {
      createSession();

      connection.setStatus(VoiceConnectionStatus.Disconnected, closedByDiscord);
      await sleep(RECONNECT_TIMEOUT_MS / 2);
      connection.setStatus(VoiceConnectionStatus.Connecting);
      await sleep(READY_TIMEOUT_MS / 2);
      connection.setStatus(VoiceConnectionStatus.Ready);
      await sleep(READY_TIMEOUT_MS + RECONNECT_TIMEOUT_MS);

      expect(lost).toEqual([]);
      expect(connection.rejoins).toEqual([]);
      expect(connection.destroyCount).toBe(0);
    });

    it('reports the session lost when Discord closes it and does not reconnect', async () => {
      const session = createSession();
      const playback = session.play(new StreamSource(oggOpus(500)), new AbortController().signal);
      await entersState(player, AudioPlayerStatus.Playing, 2000);

      connection.setStatus(VoiceConnectionStatus.Disconnected, closedByDiscord);
      await sleep(RECONNECT_TIMEOUT_MS * 2);

      expect(lost).toHaveLength(1);
      expect(lost[0]).toBeInstanceOf(VoiceConnectionError);
      expect(connection.rejoins).toEqual([]);
      expect(connection.destroyCount).toBe(1);
      await expect(playback).resolves.toBeUndefined();
    });

    it('rejoins after any other disconnect', async () => {
      createSession();

      connection.setStatus(VoiceConnectionStatus.Disconnected, gatewayUnavailable);
      await vi.waitFor(() => {
        expect(connection.rejoins).toHaveLength(1);
      });
      connection.setStatus(VoiceConnectionStatus.Ready);
      await sleep(READY_TIMEOUT_MS * 2);

      expect(lost).toEqual([]);
      expect(connection.destroyCount).toBe(0);
    });

    it('retries rejoining, waiting longer each time, until the gateway accepts', async () => {
      createSession();
      connection.failingRejoins = 3;

      connection.setStatus(VoiceConnectionStatus.Disconnected, gatewayUnavailable);
      await vi.waitFor(() => {
        expect(connection.state.status).toBe(VoiceConnectionStatus.Signalling);
      });
      connection.setStatus(VoiceConnectionStatus.Ready);
      await sleep(READY_TIMEOUT_MS * 2);

      expect(connection.rejoins).toHaveLength(4);
      expectGrowingGaps(connection.rejoins);
      expect(lost).toEqual([]);
      expect(logger.at('warn').map(({ message, context }) => [message, context])).toEqual(
        [1, 2, 3, 4].map((attempt) => ['voice connection rejoining', { attempt }]),
      );
    });

    it('reports the session lost after five failed rejoins', async () => {
      createSession();
      connection.failingRejoins = Infinity;

      connection.setStatus(VoiceConnectionStatus.Disconnected, gatewayUnavailable);
      await vi.waitFor(() => {
        expect(lost).toHaveLength(1);
      });

      expect(lost[0]).toBeInstanceOf(VoiceConnectionError);
      expect(connection.rejoins).toHaveLength(5);
      expectGrowingGaps(connection.rejoins);
      expect(connection.destroyCount).toBe(1);
    });

    it('runs one recovery at a time', async () => {
      createSession();
      connection.failingRejoins = 1;

      connection.setStatus(VoiceConnectionStatus.Disconnected, gatewayUnavailable);
      connection.setStatus(VoiceConnectionStatus.Disconnected, gatewayUnavailable);
      await vi.waitFor(() => {
        expect(connection.state.status).toBe(VoiceConnectionStatus.Signalling);
      });
      connection.setStatus(VoiceConnectionStatus.Ready);
      await sleep(REJOIN_DELAY_MS * 3);

      expect(connection.rejoins).toHaveLength(2);
      expectGrowingGaps(connection.rejoins);
    });

    it('stops recovering once destroyed', async () => {
      const session = createSession();

      connection.setStatus(VoiceConnectionStatus.Disconnected, gatewayUnavailable);
      session.destroy();
      await sleep(REJOIN_DELAY_MS * 3);

      expect(connection.rejoins).toEqual([]);
      expect(lost).toEqual([]);
    });

    it('keeps the session when the connection reconnects on its own', async () => {
      createSession();

      connection.setStatus(VoiceConnectionStatus.Signalling);
      connection.setStatus(VoiceConnectionStatus.Connecting);
      await sleep(READY_TIMEOUT_MS / 2);
      connection.setStatus(VoiceConnectionStatus.Ready);
      await sleep(READY_TIMEOUT_MS * 2);

      expect(lost).toEqual([]);
      expect(connection.rejoins).toEqual([]);
    });

    it('reports the session lost when a reconnect never completes', async () => {
      createSession();

      connection.setStatus(VoiceConnectionStatus.Signalling);
      await sleep(READY_TIMEOUT_MS * 2);

      expect(lost).toHaveLength(1);
      expect(connection.destroyCount).toBe(1);
    });

    it('reports the session lost when the connection is destroyed elsewhere', () => {
      createSession();

      connection.setStatus(VoiceConnectionStatus.Destroyed);

      expect(lost).toEqual([new VoiceConnectionError('Voice connection was destroyed')]);
      expect(connection.destroyCount).toBe(0);
    });
  });
});
