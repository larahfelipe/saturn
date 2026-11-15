import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  PlaybackCancelledError,
  PlayerUnavailableError,
  QueueFullError,
  TrackUnavailableError,
  VoiceConnectionError,
} from '../../../src/application/errors.ts';
import { GuildPlayer, type PlayRequest } from '../../../src/application/music/GuildPlayer.ts';
import {
  FakeResolver,
  FakeVoiceConnector,
  flush,
  RecordingLogger,
  trackUrl,
} from '../../fixtures/fakes.ts';

function request(id: string): PlayRequest {
  return { url: trackUrl(id), requestedBy: 'user', voiceChannelId: 'voice-1' };
}

describe('GuildPlayer', () => {
  let resolver: FakeResolver;
  let voice: FakeVoiceConnector;
  let logger: RecordingLogger;
  let onIdle: ReturnType<typeof vi.fn<() => void>>;
  let player: GuildPlayer;

  beforeEach(() => {
    resolver = new FakeResolver();
    voice = new FakeVoiceConnector();
    logger = new RecordingLogger();
    onIdle = vi.fn<() => void>();
    player = new GuildPlayer({ guildId: 'guild-1', resolver, voice, logger, onIdle });
  });

  function session() {
    const current = voice.lastSession;
    if (current === undefined) throw new Error('no voice session');
    return current;
  }

  /** Ends the only track while a second request is still resolving. */
  async function drainWhileResolving(): Promise<{ second: Promise<unknown> }> {
    await player.play(request('aaaaaaaaaaa'));
    await flush();
    resolver.manual = true;
    const second = player.play(request('bbbbbbbbbbb'));
    await flush();
    session().current?.finish();
    await flush();
    return { second };
  }

  function playingId(): string | undefined {
    return player.state.status === 'playing' || player.state.status === 'paused'
      ? player.state.current.id
      : undefined;
  }

  describe('queue processing', () => {
    it('connects to the requester channel and starts the first track', async () => {
      const result = await player.play(request('aaaaaaaaaaa'));
      await flush();

      expect(result).toMatchObject({ status: 'playing', track: { id: 'aaaaaaaaaaa' } });
      expect(voice.calls[0]?.target).toEqual({ guildId: 'guild-1', channelId: 'voice-1' });
      expect(session().playbacks).toHaveLength(1);
      expect(player.state).toMatchObject({ status: 'playing', current: { id: 'aaaaaaaaaaa' } });
    });

    it('queues later tracks with their positions and reuses the connection', async () => {
      await player.play(request('aaaaaaaaaaa'));

      await expect(player.play(request('bbbbbbbbbbb'))).resolves.toMatchObject({
        status: 'queued',
        position: 1,
      });
      await expect(player.play(request('ccccccccccc'))).resolves.toMatchObject({
        status: 'queued',
        position: 2,
      });
      expect(voice.calls).toHaveLength(1);
      expect(player.upcoming.map(({ id }) => id)).toEqual(['bbbbbbbbbbb', 'ccccccccccc']);
    });

    it('advances automatically and disconnects when the queue drains', async () => {
      await player.play(request('aaaaaaaaaaa'));
      await player.play(request('bbbbbbbbbbb'));
      await flush();

      session().current?.finish();
      await flush();
      expect(playingId()).toBe('bbbbbbbbbbb');
      expect(session().playbacks).toHaveLength(2);

      session().current?.finish();
      await flush();
      expect(player.state.status).toBe('idle');
      expect(session().destroyCount).toBe(1);
      expect(onIdle).toHaveBeenCalledOnce();
    });

    it('keeps the connection when the queue drains with a request in flight', async () => {
      const { second } = await drainWhileResolving();

      expect(player.state.status).toBe('waiting');
      expect(session().destroyed).toBe(false);
      expect(onIdle).not.toHaveBeenCalled();

      const call = resolver.calls[1];
      call?.deferred.resolve(call.result);

      await expect(second).resolves.toMatchObject({
        status: 'playing',
        track: { id: 'bbbbbbbbbbb' },
      });
      expect(voice.calls).toHaveLength(1);
      expect(session().playbacks).toHaveLength(2);
      expect(playingId()).toBe('bbbbbbbbbbb');
    });

    it('disconnects once the request it kept the connection for fails', async () => {
      const { second } = await drainWhileResolving();

      resolver.calls[1]?.deferred.reject(new TrackUnavailableError('NOT_FOUND'));

      await expect(second).rejects.toThrow(TrackUnavailableError);
      expect(player.state.status).toBe('idle');
      expect(session().destroyCount).toBe(1);
      expect(onIdle).toHaveBeenCalledOnce();
    });

    it('resolves concurrent requests in parallel and enqueues them in arrival order', async () => {
      resolver.manual = true;
      const results = [
        player.play(request('aaaaaaaaaaa')),
        player.play(request('bbbbbbbbbbb')),
        player.play(request('ccccccccccc')),
      ];
      await flush();

      expect(resolver.calls).toHaveLength(3);
      for (const index of [2, 1, 0]) {
        const call = resolver.calls[index];
        call?.deferred.resolve(call.result);
        await flush();
      }

      await expect(Promise.all(results)).resolves.toMatchObject([
        { status: 'playing', track: { id: 'aaaaaaaaaaa' } },
        { status: 'queued', position: 1, track: { id: 'bbbbbbbbbbb' } },
        { status: 'queued', position: 2, track: { id: 'ccccccccccc' } },
      ]);
      expect(voice.calls).toHaveLength(1);
    });

    it('fails only the request whose lookup failed while waiting its turn', async () => {
      resolver.manual = true;
      const first = player.play(request('aaaaaaaaaaa'));
      const second = player.play(request('bbbbbbbbbbb'));
      await flush();

      resolver.calls[1]?.deferred.reject(new TrackUnavailableError('PRIVATE'));
      await flush();
      const call = resolver.calls[0];
      call?.deferred.resolve(call.result);

      await expect(first).resolves.toMatchObject({ status: 'playing' });
      await expect(second).rejects.toThrow(TrackUnavailableError);
      expect(player.upcoming).toEqual([]);
    });

    it('skips a track whose stream fails and logs the failure', async () => {
      await player.play(request('aaaaaaaaaaa'));
      await player.play(request('bbbbbbbbbbb'));
      await flush();

      session().current?.fail(new Error('ffmpeg exited with code 1'));
      await flush();

      expect(playingId()).toBe('bbbbbbbbbbb');
      expect(logger.at('error')).toMatchObject([
        { message: 'track playback failed', context: { trackId: 'aaaaaaaaaaa' } },
      ]);
    });
  });

  describe('queue limit', () => {
    beforeEach(() => {
      player = new GuildPlayer({
        guildId: 'guild-1',
        resolver,
        voice,
        logger,
        onIdle,
        maxQueueLength: 2,
      });
    });

    it('refuses requests once the queue is full', async () => {
      await player.play(request('aaaaaaaaaaa'));
      await player.play(request('bbbbbbbbbbb'));
      await player.play(request('ccccccccccc'));

      await expect(player.play(request('ddddddddddd'))).rejects.toThrow(QueueFullError);
      expect(resolver.calls).toHaveLength(3);
      expect(player.upcoming.map(({ id }) => id)).toEqual(['bbbbbbbbbbb', 'ccccccccccc']);
    });

    it('counts requests still resolving', async () => {
      resolver.manual = true;
      const pending = [player.play(request('aaaaaaaaaaa')), player.play(request('bbbbbbbbbbb'))];

      await expect(player.play(request('ccccccccccc'))).rejects.toThrow(QueueFullError);
      expect(resolver.calls).toHaveLength(2);
      player.stop();
      for (const play of pending) await expect(play).rejects.toThrow(PlaybackCancelledError);
    });

    it('accepts requests again once the queue has room', async () => {
      await player.play(request('aaaaaaaaaaa'));
      await player.play(request('bbbbbbbbbbb'));
      await player.play(request('ccccccccccc'));
      await flush();

      session().current?.finish();
      await flush();

      await expect(player.play(request('ddddddddddd'))).resolves.toMatchObject({
        status: 'queued',
        position: 2,
      });
    });
  });

  describe('controls', () => {
    it('pauses and resumes the active session', async () => {
      await player.play(request('aaaaaaaaaaa'));
      await flush();

      expect(player.pause()).toBe(true);
      expect(player.state.status).toBe('paused');
      expect(session().paused).toBe(true);

      expect(player.resume()).toBe(true);
      expect(player.state.status).toBe('playing');
      expect(session().paused).toBe(false);
    });

    it('accepts repeated pause and resume like the reference implementation', async () => {
      await player.play(request('aaaaaaaaaaa'));
      await flush();

      expect(player.resume()).toBe(true);
      expect(player.pause()).toBe(true);
      expect(player.pause()).toBe(true);
      expect(player.state.status).toBe('paused');
    });

    it('ends rapid pause/resume sequences in the last requested state', async () => {
      await player.play(request('aaaaaaaaaaa'));
      await flush();

      for (let index = 0; index < 25; index++) {
        if (index % 2 === 0) player.pause();
        else player.resume();
      }

      expect(player.state.status).toBe('paused');
      expect(session().paused).toBe(true);
    });

    it('rejects controls while idle', () => {
      expect(player.pause()).toBe(false);
      expect(player.resume()).toBe(false);
      expect(player.skip()).toBe(false);
      expect(player.stop()).toBe(false);
    });

    it('refuses a pause between tracks instead of losing it', async () => {
      await player.play(request('aaaaaaaaaaa'));
      await player.play(request('bbbbbbbbbbb'));
      await flush();

      session().current?.finish();

      expect(player.pause()).toBe(false);
      expect(player.state.status).toBe('playing');
      await flush();
      expect(playingId()).toBe('bbbbbbbbbbb');
      expect(player.pause()).toBe(true);
      expect(session().paused).toBe(true);
    });

    it('refuses a resume between tracks', async () => {
      await player.play(request('aaaaaaaaaaa'));
      await player.play(request('bbbbbbbbbbb'));
      await flush();
      player.pause();

      session().current?.finish();

      expect(player.resume()).toBe(false);
      expect(player.state.status).toBe('paused');
      await flush();
      expect(player.state).toMatchObject({ status: 'playing', current: { id: 'bbbbbbbbbbb' } });
      expect(session().paused).toBe(false);
    });

    it('rejects pause, resume and skip while connecting', async () => {
      voice.manual = true;
      void player.play(request('aaaaaaaaaaa')).catch(() => undefined);
      await flush();

      expect(player.state.status).toBe('connecting');
      expect(player.pause()).toBe(false);
      expect(player.resume()).toBe(false);
      expect(player.skip()).toBe(false);
    });

    it('skips to the next track', async () => {
      await player.play(request('aaaaaaaaaaa'));
      await player.play(request('bbbbbbbbbbb'));
      await flush();
      const first = session().current;

      expect(player.skip()).toBe(true);
      await flush();

      expect(first?.signal.aborted).toBe(true);
      expect(playingId()).toBe('bbbbbbbbbbb');
    });

    it('resumes playback when skipping from a paused track', async () => {
      await player.play(request('aaaaaaaaaaa'));
      await player.play(request('bbbbbbbbbbb'));
      await flush();
      player.pause();

      player.skip();
      await flush();

      expect(player.state).toMatchObject({ status: 'playing', current: { id: 'bbbbbbbbbbb' } });
    });

    it('goes idle and disconnects when skipping the last track', async () => {
      await player.play(request('aaaaaaaaaaa'));
      await flush();

      expect(player.skip()).toBe(true);
      await flush();

      expect(player.state.status).toBe('idle');
      expect(session().destroyed).toBe(true);
    });

    it('advances exactly once when a skip races with the end of a track', async () => {
      await player.play(request('aaaaaaaaaaa'));
      await player.play(request('bbbbbbbbbbb'));
      await player.play(request('ccccccccccc'));
      await flush();

      session().current?.finish();
      player.skip();
      await flush();

      expect(playingId()).toBe('bbbbbbbbbbb');
      expect(player.upcoming.map(({ id }) => id)).toEqual(['ccccccccccc']);
    });
  });

  describe('stop and cancellation', () => {
    it('stops playback, clears the queue and disconnects', async () => {
      await player.play(request('aaaaaaaaaaa'));
      await player.play(request('bbbbbbbbbbb'));
      await flush();
      const playback = session().current;

      expect(player.stop()).toBe(true);

      expect(player.state.status).toBe('idle');
      expect(player.upcoming).toEqual([]);
      expect(playback?.signal.aborted).toBe(true);
      expect(session().destroyCount).toBe(1);
      expect(onIdle).toHaveBeenCalledOnce();
    });

    it('cancels a request that is still resolving', async () => {
      resolver.manual = true;
      const pending = player.play(request('aaaaaaaaaaa'));
      await flush();

      expect(player.stop()).toBe(true);

      await expect(pending).rejects.toThrow(PlaybackCancelledError);
      expect(resolver.calls[0]?.signal.aborted).toBe(true);
      expect(voice.calls).toHaveLength(0);
      expect(player.state.status).toBe('idle');
    });

    it('cancels requests waiting behind a slow one', async () => {
      resolver.manual = true;
      const first = player.play(request('aaaaaaaaaaa'));
      const second = player.play(request('bbbbbbbbbbb'));
      await flush();

      player.stop();

      await expect(first).rejects.toThrow(PlaybackCancelledError);
      await expect(second).rejects.toThrow(PlaybackCancelledError);
      expect(resolver.calls.every(({ signal }) => signal.aborted)).toBe(true);
    });

    it('rejects other controls but stops while waiting for a request', async () => {
      const { second } = await drainWhileResolving();

      expect(player.pause()).toBe(false);
      expect(player.resume()).toBe(false);
      expect(player.skip()).toBe(false);
      expect(player.stop()).toBe(true);

      await expect(second).rejects.toThrow(PlaybackCancelledError);
      expect(player.state.status).toBe('idle');
      expect(session().destroyCount).toBe(1);
    });

    it('cancels a voice connection in progress', async () => {
      voice.manual = true;
      const pending = player.play(request('aaaaaaaaaaa'));
      await flush();

      expect(player.stop()).toBe(true);

      await expect(pending).rejects.toThrow(PlaybackCancelledError);
      expect(voice.calls[0]?.options.signal.aborted).toBe(true);
      expect(player.state.status).toBe('idle');
    });

    it('destroys a connection that completes after stop', async () => {
      voice.manual = true;
      const pending = player.play(request('aaaaaaaaaaa'));
      await flush();
      const call = voice.calls[0];

      call?.deferred.resolve(call.session);
      player.stop();

      await expect(pending).rejects.toThrow(PlaybackCancelledError);
      expect(call?.session.destroyed).toBe(true);
      expect(player.state.status).toBe('idle');
    });

    it('never lets a stale playback loop touch a restarted player', async () => {
      await player.play(request('aaaaaaaaaaa'));
      await flush();
      const oldSession = session();

      player.stop();
      await player.play(request('bbbbbbbbbbb'));
      await player.play(request('ccccccccccc'));
      await flush();

      expect(oldSession.playbacks).toHaveLength(1);
      expect(voice.calls).toHaveLength(2);
      expect(playingId()).toBe('bbbbbbbbbbb');
      expect(player.upcoming.map(({ id }) => id)).toEqual(['ccccccccccc']);
      expect(logger.at('error')).toEqual([]);
    });

    it('ignores a cancelled playback that settles after a restart', async () => {
      voice.settleOnAbort = false;
      await player.play(request('aaaaaaaaaaa'));
      await flush();
      const stale = session().current;

      player.stop();
      await player.play(request('bbbbbbbbbbb'));
      await player.play(request('ccccccccccc'));
      await flush();
      stale?.finish();
      await flush();

      expect(playingId()).toBe('bbbbbbbbbbb');
      expect(player.upcoming.map(({ id }) => id)).toEqual(['ccccccccccc']);
      expect(session().destroyed).toBe(false);
      expect(logger.at('error')).toEqual([]);
    });
  });

  describe('failures', () => {
    it('propagates resolution errors without connecting', async () => {
      resolver.failWith = new TrackUnavailableError('NOT_FOUND');

      await expect(player.play(request('aaaaaaaaaaa'))).rejects.toThrow(TrackUnavailableError);
      expect(voice.calls).toHaveLength(0);
      expect(player.isIdle).toBe(true);
      expect(onIdle).toHaveBeenCalledOnce();
    });

    it('propagates voice connection errors and enqueues nothing', async () => {
      voice.failWith = new VoiceConnectionError('timed out');

      await expect(player.play(request('aaaaaaaaaaa'))).rejects.toThrow(VoiceConnectionError);
      expect(player.state.status).toBe('idle');
      expect(player.upcoming).toEqual([]);

      voice.failWith = undefined;
      await expect(player.play(request('bbbbbbbbbbb'))).resolves.toMatchObject({
        status: 'playing',
      });
    });

    it('tears down when the voice connection is lost', async () => {
      await player.play(request('aaaaaaaaaaa'));
      await player.play(request('bbbbbbbbbbb'));
      await flush();

      voice.calls[0]?.options.onLost(new Error('disconnected'));

      expect(player.state.status).toBe('idle');
      expect(player.upcoming).toEqual([]);
      expect(session().destroyed).toBe(true);
      expect(logger.at('warn')).toMatchObject([{ message: 'voice connection lost' }]);
    });

    it('ignores a connection loss reported after stop', async () => {
      await player.play(request('aaaaaaaaaaa'));
      await flush();
      const onLost = voice.calls[0]?.options.onLost;
      player.stop();
      await player.play(request('bbbbbbbbbbb'));

      onLost?.(new Error('late disconnect'));

      expect(playingId()).toBe('bbbbbbbbbbb');
      expect(logger.at('warn')).toEqual([]);
    });
  });

  describe('disposal', () => {
    it('releases resources and rejects further work', async () => {
      await player.play(request('aaaaaaaaaaa'));
      await flush();

      player.dispose();

      expect(player.isDisposed).toBe(true);
      expect(session().destroyed).toBe(true);
      expect(player.state.status).toBe('idle');
      await expect(player.play(request('bbbbbbbbbbb'))).rejects.toThrow(PlayerUnavailableError);
      expect(player.pause()).toBe(false);
      expect(player.skip()).toBe(false);
      expect(player.stop()).toBe(false);
      expect(onIdle).not.toHaveBeenCalled();
    });

    it('fails pending requests as unavailable', async () => {
      resolver.manual = true;
      const pending = player.play(request('aaaaaaaaaaa'));
      await flush();

      player.dispose();
      player.dispose();

      await expect(pending).rejects.toThrow(PlayerUnavailableError);
    });
  });
});
