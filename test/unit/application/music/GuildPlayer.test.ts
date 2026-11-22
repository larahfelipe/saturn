import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  InvalidTrackUrlError,
  NotListeningError,
  PlaybackCancelledError,
  PlayerUnavailableError,
  QueueFullError,
  QueuePositionError,
  TrackUnavailableError,
  VoiceConnectionError,
} from '../../../../src/application/errors.ts';
import {
  EMPTY_CHANNEL_TIMEOUT_MS,
  GuildPlayer,
} from '../../../../src/application/music/GuildPlayer.ts';
import type { PlayRequest } from '../../../../src/application/music/GuildPlayer.ts';
import {
  FakeResolver,
  FakeVoiceConnector,
  flush,
  RecordingLogger,
  trackUrl,
} from '../../../fixtures/fakes.ts';

function request(id: string): PlayRequest {
  return { requestedBy: 'user', url: trackUrl(id), voiceChannelId: 'voice-1' };
}

describe(GuildPlayer, () => {
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
    player = new GuildPlayer({ guildId: 'guild-1', logger, onIdle, resolver, voice });
  });

  function session() {
    const current = voice.lastSession;
    if (current === undefined) throw new Error('no voice session');
    return current;
  }

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

  function upcomingIds(): string[] {
    return player.upcoming.map(({ id }) => id);
  }

  async function playAll(...ids: string[]): Promise<void> {
    for (const id of ids) await player.play(request(id));
    await flush();
  }

  describe('queue processing', () => {
    it('connects to the requester channel and starts the first track', async () => {
      const result = await player.play(request('aaaaaaaaaaa'));
      await flush();

      expect(result).toMatchObject({ status: 'playing', track: { id: 'aaaaaaaaaaa' } });
      expect(voice.calls[0]?.target).toEqual({ channelId: 'voice-1', guildId: 'guild-1' });
      expect(session().playbacks).toHaveLength(1);
      expect(player.state).toMatchObject({ current: { id: 'aaaaaaaaaaa' }, status: 'playing' });
    });

    it('joins the voice channel while the track is still resolving', async () => {
      resolver.manual = true;
      const play = player.play(request('aaaaaaaaaaa'));
      await flush();

      expect(voice.calls).toHaveLength(1);
      expect(player.state.status).toBe('connecting');
      const call = resolver.calls[0];
      call?.deferred.resolve(call.result);

      await expect(play).resolves.toMatchObject({ status: 'playing' });
      expect(session().playbacks).toHaveLength(1);
    });

    it('shares the join with requests made while joining', async () => {
      voice.manual = true;
      const first = player.play(request('aaaaaaaaaaa'));
      const second = player.play(request('bbbbbbbbbbb'));
      await flush();
      voice.calls[0]?.deferred.resolve(session());

      await expect(first).resolves.toMatchObject({ status: 'playing' });
      await expect(second).resolves.toMatchObject({ position: 1, status: 'queued' });
      expect(voice.calls).toHaveLength(1);
    });

    it('keeps joining for the requests left when one lookup fails', async () => {
      resolver.manual = true;
      voice.manual = true;
      const first = player.play(request('aaaaaaaaaaa'));
      const second = player.play(request('bbbbbbbbbbb'));
      await flush();

      resolver.calls[0]?.deferred.reject(new TrackUnavailableError('PRIVATE'));
      await expect(first).rejects.toThrow(TrackUnavailableError);
      expect(voice.calls[0]?.options.signal.aborted).toBe(false);

      voice.calls[0]?.deferred.resolve(session());
      const call = resolver.calls[1];
      call?.deferred.resolve(call.result);
      await expect(second).resolves.toMatchObject({
        status: 'playing',
        track: { id: 'bbbbbbbbbbb' },
      });
      expect(voice.calls).toHaveLength(1);
    });

    it('queues later tracks with their positions and reuses the connection', async () => {
      await player.play(request('aaaaaaaaaaa'));

      await expect(player.play(request('bbbbbbbbbbb'))).resolves.toMatchObject({
        position: 1,
        status: 'queued',
      });
      await expect(player.play(request('ccccccccccc'))).resolves.toMatchObject({
        position: 2,
        status: 'queued',
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
        { position: 1, status: 'queued', track: { id: 'bbbbbbbbbbb' } },
        { position: 2, status: 'queued', track: { id: 'ccccccccccc' } },
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
        { context: { trackId: 'aaaaaaaaaaa' }, message: 'track playback failed' },
      ]);
    });
  });

  describe('queue limit', () => {
    beforeEach(() => {
      player = new GuildPlayer({
        guildId: 'guild-1',
        logger,
        maxQueueLength: 2,
        onIdle,
        resolver,
        voice,
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
        position: 2,
        status: 'queued',
      });
    });
  });

  describe('voice channel', () => {
    const elsewhere: PlayRequest = { ...request('bbbbbbbbbbb'), voiceChannelId: 'voice-2' };

    it('reports the channel it is connecting to, then the one it is in', async () => {
      voice.manual = true;
      const play = player.play(request('aaaaaaaaaaa'));
      await flush();

      expect(player.channelId).toBe('voice-1');
      voice.calls[0]?.deferred.resolve(session());
      await play;
      session().channelId = 'voice-2';
      expect(player.channelId).toBe('voice-2');
      player.stop();
      expect(player.channelId).toBeUndefined();
    });

    it('refuses requests from another channel while connecting, before any lookup', async () => {
      voice.manual = true;
      const play = player.play(request('aaaaaaaaaaa'));
      await flush();

      await expect(player.play(elsewhere)).rejects.toThrow(NotListeningError);
      expect(resolver.calls).toHaveLength(1);
      player.stop();
      await expect(play).rejects.toThrow(PlaybackCancelledError);
    });

    it('refuses a request whose channel the bot left while it resolved', async () => {
      await player.play(request('aaaaaaaaaaa'));
      resolver.manual = true;
      const second = player.play(request('bbbbbbbbbbb'));
      await flush();

      session().channelId = 'voice-2';
      const call = resolver.calls[1];
      call?.deferred.resolve(call.result);

      await expect(second).rejects.toThrow(NotListeningError);
      expect(player.upcoming).toEqual([]);
    });

    it('leaves when the bot was moved before its first track resolved', async () => {
      resolver.manual = true;
      const play = player.play(request('aaaaaaaaaaa'));
      await flush();

      session().channelId = 'voice-2';
      const call = resolver.calls[0];
      call?.deferred.resolve(call.result);

      await expect(play).rejects.toThrow(NotListeningError);
      expect(session().destroyed).toBe(true);
      expect(player.isIdle).toBe(true);
      expect(onIdle).toHaveBeenCalledOnce();
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
      expect(player.state).toMatchObject({ current: { id: 'bbbbbbbbbbb' }, status: 'playing' });
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

      expect(player.state).toMatchObject({ current: { id: 'bbbbbbbbbbb' }, status: 'playing' });
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

  describe('now playing', () => {
    it('reports nothing while idle or connecting', async () => {
      expect(player.nowPlaying).toBeUndefined();

      voice.manual = true;
      void player.play(request('aaaaaaaaaaa')).catch(() => undefined);
      await flush();

      expect(player.state.status).toBe('connecting');
      expect(player.nowPlaying).toBeUndefined();
    });

    it('reports the current track, its elapsed time and whether it is paused', async () => {
      await playAll('aaaaaaaaaaa');
      session().elapsedMs = 42_000;

      expect(player.nowPlaying).toMatchObject({
        elapsedMs: 42_000,
        paused: false,
        track: { id: 'aaaaaaaaaaa' },
      });

      player.pause();
      expect(player.nowPlaying).toMatchObject({ paused: true, track: { id: 'aaaaaaaaaaa' } });
    });
  });

  describe('queue edits', () => {
    it('queues a track ahead of the others when requested next', async () => {
      await playAll('aaaaaaaaaaa', 'bbbbbbbbbbb');

      await expect(player.play({ ...request('ccccccccccc'), next: true })).resolves.toMatchObject({
        position: 1,
        status: 'queued',
      });
      expect(upcomingIds()).toEqual(['ccccccccccc', 'bbbbbbbbbbb']);
    });

    it('plays a track requested next at once when nothing is playing', async () => {
      await expect(player.play({ ...request('aaaaaaaaaaa'), next: true })).resolves.toMatchObject({
        status: 'playing',
      });
    });

    it('removes a queued track', async () => {
      await playAll('aaaaaaaaaaa', 'bbbbbbbbbbb', 'ccccccccccc');

      expect(player.remove(1)).toMatchObject({ id: 'bbbbbbbbbbb' });
      expect(upcomingIds()).toEqual(['ccccccccccc']);
      expect(playingId()).toBe('aaaaaaaaaaa');
    });

    it('moves a queued track', async () => {
      await playAll('aaaaaaaaaaa', 'bbbbbbbbbbb', 'ccccccccccc', 'ddddddddddd');

      expect(player.move(3, 1)).toMatchObject({ id: 'ddddddddddd' });
      expect(upcomingIds()).toEqual(['ddddddddddd', 'bbbbbbbbbbb', 'ccccccccccc']);
    });

    it('shuffles the queue and reports its size', async () => {
      await playAll('aaaaaaaaaaa', 'bbbbbbbbbbb', 'ccccccccccc', 'ddddddddddd');

      expect(player.shuffle()).toBe(3);
      expect(upcomingIds().toSorted((a, b) => a.localeCompare(b))).toEqual([
        'bbbbbbbbbbb',
        'ccccccccccc',
        'ddddddddddd',
      ]);
      expect(playingId()).toBe('aaaaaaaaaaa');
    });

    it('clears the queue but keeps the current track playing', async () => {
      await playAll('aaaaaaaaaaa', 'bbbbbbbbbbb', 'ccccccccccc');

      expect(player.clear()).toBe(2);
      expect(upcomingIds()).toEqual([]);
      expect(playingId()).toBe('aaaaaaaaaaa');
      expect(session().destroyed).toBe(false);

      session().current?.finish();
      await flush();
      expect(player.state.status).toBe('idle');
    });

    it('skips to a queued track, dropping the tracks ahead of it', async () => {
      await playAll('aaaaaaaaaaa', 'bbbbbbbbbbb', 'ccccccccccc', 'ddddddddddd');
      const first = session().current;

      expect(player.skipTo(2)).toMatchObject({ id: 'ccccccccccc' });
      await flush();

      expect(first?.signal.aborted).toBe(true);
      expect(playingId()).toBe('ccccccccccc');
      expect(upcomingIds()).toEqual(['ddddddddddd']);
    });

    it('rejects positions outside the queue and changes nothing', async () => {
      await playAll('aaaaaaaaaaa', 'bbbbbbbbbbb', 'ccccccccccc');
      const current = session().current;

      expect(() => player.remove(3)).toThrow(expect.objectContaining({ size: 2 }));
      expect(() => player.move(1, 3)).toThrow(QueuePositionError);
      expect(() => player.move(0, 1)).toThrow(QueuePositionError);
      expect(() => player.skipTo(3)).toThrow(QueuePositionError);
      await flush();

      expect(current?.signal.aborted).toBe(false);
      expect(playingId()).toBe('aaaaaaaaaaa');
      expect(upcomingIds()).toEqual(['bbbbbbbbbbb', 'ccccccccccc']);
    });

    it('treats every position as outside an empty queue', async () => {
      await playAll('aaaaaaaaaaa');

      expect(() => player.remove(1)).toThrow(expect.objectContaining({ size: 0 }));
      expect(() => player.skipTo(1)).toThrow(QueuePositionError);
      expect(player.shuffle()).toBe(0);
      expect(player.clear()).toBe(0);
    });
  });

  describe('empty voice channel', () => {
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('leaves once the channel has had no listeners for the timeout', async () => {
      await playAll('aaaaaaaaaaa', 'bbbbbbbbbbb');

      player.updateListeners('voice-1', 0);
      vi.advanceTimersByTime(EMPTY_CHANNEL_TIMEOUT_MS - 1);
      expect(playingId()).toBe('aaaaaaaaaaa');

      vi.advanceTimersByTime(1);
      expect(player.state.status).toBe('idle');
      expect(player.upcoming).toEqual([]);
      expect(session().destroyed).toBe(true);
      expect(onIdle).toHaveBeenCalledOnce();
      expect(logger.contextOf('info', 'leaving empty voice channel')).toMatchObject({
        channelId: 'voice-1',
      });
    });

    it('stays when a listener returns before the timeout', async () => {
      await playAll('aaaaaaaaaaa');

      player.updateListeners('voice-1', 0);
      vi.advanceTimersByTime(EMPTY_CHANNEL_TIMEOUT_MS - 1);
      player.updateListeners('voice-1', 1);
      vi.advanceTimersByTime(EMPTY_CHANNEL_TIMEOUT_MS);

      expect(playingId()).toBe('aaaaaaaaaaa');
      expect(vi.getTimerCount()).toBe(0);
    });

    it('counts the timeout from when the channel first emptied', async () => {
      await playAll('aaaaaaaaaaa');

      player.updateListeners('voice-1', 0);
      vi.advanceTimersByTime(EMPTY_CHANNEL_TIMEOUT_MS / 2);
      player.updateListeners('voice-1', 0);
      vi.advanceTimersByTime(EMPTY_CHANNEL_TIMEOUT_MS / 2);

      expect(player.state.status).toBe('idle');
    });

    it('ignores counts for other channels and while idle', async () => {
      player.updateListeners('voice-1', 0);
      expect(vi.getTimerCount()).toBe(0);

      await playAll('aaaaaaaaaaa');
      player.updateListeners('voice-2', 0);

      expect(vi.getTimerCount()).toBe(0);
    });

    it('follows the channel the bot was moved to', async () => {
      await playAll('aaaaaaaaaaa');
      player.updateListeners('voice-1', 0);

      session().channelId = 'voice-2';
      player.updateListeners('voice-2', 2);

      expect(vi.getTimerCount()).toBe(0);
    });

    it('leaves an empty channel it is still joining', async () => {
      voice.manual = true;
      const pending = player.play(request('aaaaaaaaaaa'));
      await flush();

      player.updateListeners('voice-1', 0);
      vi.advanceTimersByTime(EMPTY_CHANNEL_TIMEOUT_MS);

      await expect(pending).rejects.toThrow(PlaybackCancelledError);
      expect(player.state.status).toBe('idle');
    });

    it('cancels the timeout when playback ends on its own', async () => {
      await playAll('aaaaaaaaaaa');
      player.updateListeners('voice-1', 0);

      session().current?.finish();
      await flush();
      expect(vi.getTimerCount()).toBe(0);

      await playAll('bbbbbbbbbbb');
      vi.advanceTimersByTime(EMPTY_CHANNEL_TIMEOUT_MS);
      expect(playingId()).toBe('bbbbbbbbbbb');
    });

    it('cancels the timeout when stopped', async () => {
      await playAll('aaaaaaaaaaa');
      player.updateListeners('voice-1', 0);

      player.stop();

      expect(vi.getTimerCount()).toBe(0);
    });

    it('cancels the timeout when the voice connection is lost', async () => {
      await playAll('aaaaaaaaaaa');
      player.updateListeners('voice-1', 0);

      voice.calls[0]?.options.onLost(new Error('disconnected'));

      expect(vi.getTimerCount()).toBe(0);
    });

    it('cancels the timeout when joining fails', async () => {
      voice.manual = true;
      const pending = player.play(request('aaaaaaaaaaa'));
      await flush();
      player.updateListeners('voice-1', 0);

      voice.calls[0]?.deferred.reject(new VoiceConnectionError('timed out'));

      await expect(pending).rejects.toThrow(VoiceConnectionError);
      expect(vi.getTimerCount()).toBe(0);
    });

    it('cancels the timeout when disposed', async () => {
      await playAll('aaaaaaaaaaa');
      player.updateListeners('voice-1', 0);

      player.dispose();

      expect(vi.getTimerCount()).toBe(0);
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

    it('cancels a request that is still resolving and its join', async () => {
      resolver.manual = true;
      voice.manual = true;
      const pending = player.play(request('aaaaaaaaaaa'));
      await flush();

      expect(player.stop()).toBe(true);

      await expect(pending).rejects.toThrow(PlaybackCancelledError);
      expect(resolver.calls[0]?.signal.aborted).toBe(true);
      expect(voice.calls[0]?.options.signal.aborted).toBe(true);
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
    it('refuses a request the resolver rejects at once without joining', async () => {
      resolver.refuseWith = new InvalidTrackUrlError();

      await expect(player.play(request('aaaaaaaaaaa'))).rejects.toThrow(InvalidTrackUrlError);
      expect(voice.calls).toHaveLength(0);
      expect(player.isIdle).toBe(true);
      expect(onIdle).toHaveBeenCalledOnce();
    });

    it('propagates resolution errors and leaves the voice channel', async () => {
      resolver.failWith = new TrackUnavailableError('NOT_FOUND');

      await expect(player.play(request('aaaaaaaaaaa'))).rejects.toThrow(TrackUnavailableError);
      expect(session().destroyed).toBe(true);
      expect(player.isIdle).toBe(true);
      expect(onIdle).toHaveBeenCalledOnce();
    });

    it('cancels the join when the lookup fails first', async () => {
      resolver.manual = true;
      voice.manual = true;
      const play = player.play(request('aaaaaaaaaaa'));
      await flush();

      resolver.calls[0]?.deferred.reject(new TrackUnavailableError('NOT_FOUND'));

      await expect(play).rejects.toThrow(TrackUnavailableError);
      expect(voice.calls[0]?.options.signal.aborted).toBe(true);
      expect(player.isIdle).toBe(true);
    });

    it('reports the lookup error when joining fails too', async () => {
      resolver.manual = true;
      voice.failWith = new VoiceConnectionError('timed out');
      const play = player.play(request('aaaaaaaaaaa'));
      await flush();

      resolver.calls[0]?.deferred.reject(new TrackUnavailableError('NOT_FOUND'));

      await expect(play).rejects.toThrow(TrackUnavailableError);
      expect(voice.calls).toHaveLength(1);
    });

    it('fails every request waiting on a failed join without joining again', async () => {
      resolver.manual = true;
      voice.manual = true;
      const first = player.play(request('aaaaaaaaaaa'));
      const second = player.play(request('bbbbbbbbbbb'));
      await flush();

      voice.calls[0]?.deferred.reject(new VoiceConnectionError('timed out'));
      for (const call of resolver.calls) call.deferred.resolve(call.result);

      await expect(first).rejects.toThrow(VoiceConnectionError);
      await expect(second).rejects.toThrow(VoiceConnectionError);
      expect(voice.calls).toHaveLength(1);
      expect(player.isIdle).toBe(true);
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

  describe('timing', () => {
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['performance'] });
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('logs how long the lookup and the join took', async () => {
      resolver.manual = true;
      voice.manual = true;
      const play = player.play(request('aaaaaaaaaaa'));
      await flush();

      vi.advanceTimersByTime(300);
      voice.calls[0]?.deferred.resolve(session());
      await flush();
      vi.advanceTimersByTime(500);
      const call = resolver.calls[0];
      call?.deferred.resolve(call.result);
      await play;

      expect(logger.contextOf('info', 'voice channel joined')).toEqual({
        channelId: 'voice-1',
        joinMs: 300,
      });
      expect(logger.contextOf('info', 'track resolved')).toEqual({
        lookupMs: 800,
        trackId: 'aaaaaaaaaaa',
      });
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
