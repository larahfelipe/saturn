import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  NotInVoiceChannelError,
  NotListeningError,
  QueuePositionError,
  RateLimitedError,
} from '../../../../src/application/errors.ts';
import { EMPTY_CHANNEL_TIMEOUT_MS } from '../../../../src/application/music/GuildPlayer.ts';
import { PlaybackService } from '../../../../src/application/music/PlaybackService.ts';
import type { PlayCommand } from '../../../../src/application/music/PlaybackService.ts';
import { PlayerRegistry } from '../../../../src/application/music/PlayerRegistry.ts';
import { RateLimiter } from '../../../../src/application/RateLimiter.ts';
import {
  FakeResolver,
  FakeVoiceConnector,
  flush,
  RecordingLogger,
  trackUrl,
} from '../../../fixtures/fakes.ts';

function command(guildId: string, overrides: Partial<PlayCommand> = {}): PlayCommand {
  return {
    guildId,
    requestedBy: 'user',
    url: trackUrl('aaaaaaaaaaa'),
    voiceChannelId: `voice-${guildId}`,
    ...overrides,
  };
}

describe(PlaybackService, () => {
  let resolver: FakeResolver;
  let voice: FakeVoiceConnector;
  let registry: PlayerRegistry;
  let service: PlaybackService;

  beforeEach(() => {
    resolver = new FakeResolver();
    voice = new FakeVoiceConnector();
    registry = new PlayerRegistry({ logger: new RecordingLogger(), resolver, voice });
    service = new PlaybackService(registry);
  });

  it('requires the requester to be in a voice channel', async () => {
    await expect(service.play(command('guild-1', { voiceChannelId: undefined }))).rejects.toThrow(
      NotInVoiceChannelError,
    );
    expect(resolver.calls).toHaveLength(0);
    expect(registry.size).toBe(0);
  });

  describe('request rate limit', () => {
    let now: number;

    beforeEach(() => {
      now = 0;
      service = new PlaybackService(registry, {
        playLimiter: new RateLimiter({ limit: 2, now: () => now, windowMs: 10_000 }),
      });
    });

    it('refuses a user who requests too often, before any lookup', async () => {
      await service.play(command('guild-1'));
      now += 4000;
      await service.play(command('guild-1'));

      await expect(service.play(command('guild-2'))).rejects.toThrow(
        expect.objectContaining({ name: RateLimitedError.name, retryAfterMs: 6000 }),
      );
      expect(resolver.calls).toHaveLength(2);
      await expect(
        service.play(command('guild-1', { requestedBy: 'other' })),
      ).resolves.toBeDefined();
    });

    it('does not count requests from outside a voice channel', async () => {
      const outside = command('guild-1', { voiceChannelId: undefined });
      await expect(service.play(outside)).rejects.toThrow(NotInVoiceChannelError);
      await expect(service.play(outside)).rejects.toThrow(NotInVoiceChannelError);

      await expect(service.play(command('guild-1'))).resolves.toBeDefined();
    });
  });

  it('plays in the requester voice channel', async () => {
    await expect(service.play(command('guild-1'))).resolves.toMatchObject({ status: 'playing' });

    expect(resolver.calls[0]?.request).toEqual({
      requestedBy: 'user',
      url: trackUrl('aaaaaaaaaaa'),
    });
    expect(voice.calls[0]?.target).toEqual({ channelId: 'voice-guild-1', guildId: 'guild-1' });
  });

  it('reports controls on guilds without a player as unsuccessful', () => {
    expect(service.pause('guild-1', 'voice-guild-1')).toBe(false);
    expect(service.resume('guild-1', 'voice-guild-1')).toBe(false);
    expect(service.skip('guild-1', 'voice-guild-1')).toBe(false);
    expect(service.stop('guild-1', 'voice-guild-1')).toBe(false);
    expect(registry.size).toBe(0);
  });

  it('reports an empty queue on guilds without a player', () => {
    expect(service.nowPlaying('guild-1')).toBeUndefined();
    expect(service.upcoming('guild-1')).toEqual([]);
    expect(service.shuffle('guild-1', 'voice-guild-1')).toBe(0);
    expect(service.clear('guild-1', 'voice-guild-1')).toBe(0);
    expect(() => service.remove('guild-1', 'voice-guild-1', 1)).toThrow(
      expect.objectContaining({ name: QueuePositionError.name, size: 0 }),
    );
    expect(() => service.move('guild-1', 'voice-guild-1', 1, 2)).toThrow(QueuePositionError);
    expect(() => service.skipTo('guild-1', 'voice-guild-1', 1)).toThrow(QueuePositionError);
    service.updateListeners({ channelId: 'voice-guild-1', guildId: 'guild-1', listeners: 0 });
    expect(registry.size).toBe(0);
  });

  it('routes queue reads and edits to the guild player', async () => {
    for (const id of ['aaaaaaaaaaa', 'bbbbbbbbbbb', 'ccccccccccc', 'ddddddddddd']) {
      await service.play(command('guild-1', { url: trackUrl(id) }));
    }
    await expect(
      service.play(command('guild-1', { next: true, url: trackUrl('eeeeeeeeeee') })),
    ).resolves.toMatchObject({ position: 1, status: 'queued' });
    await flush();
    const upcoming = (): string[] => service.upcoming('guild-1').map(({ id }) => id);

    expect(service.nowPlaying('guild-1')).toMatchObject({ track: { id: 'aaaaaaaaaaa' } });
    expect(upcoming()).toEqual(['eeeeeeeeeee', 'bbbbbbbbbbb', 'ccccccccccc', 'ddddddddddd']);
    expect(service.remove('guild-1', 'voice-guild-1', 1)).toMatchObject({ id: 'eeeeeeeeeee' });
    expect(service.move('guild-1', 'voice-guild-1', 3, 1)).toMatchObject({ id: 'ddddddddddd' });
    expect(upcoming()).toEqual(['ddddddddddd', 'bbbbbbbbbbb', 'ccccccccccc']);
    expect(service.shuffle('guild-1', 'voice-guild-1')).toBe(3);
    const [, second, third] = upcoming();
    expect(service.skipTo('guild-1', 'voice-guild-1', 2)).toMatchObject({ id: second });
    await flush();
    expect(service.nowPlaying('guild-1')?.track.id).toBe(second);
    expect(upcoming()).toEqual([third]);
    expect(service.clear('guild-1', 'voice-guild-1')).toBe(1);
  });

  it('routes controls to the guild player', async () => {
    await service.play(command('guild-1'));
    await service.play(command('guild-1', { url: trackUrl('bbbbbbbbbbb') }));
    await flush();

    expect(service.pause('guild-1', 'voice-guild-1')).toBe(true);
    expect(registry.get('guild-1')?.state.status).toBe('paused');
    expect(service.resume('guild-1', 'voice-guild-1')).toBe(true);
    expect(service.skip('guild-1', 'voice-guild-1')).toBe(true);
    await flush();
    expect(registry.get('guild-1')?.state).toMatchObject({ current: { id: 'bbbbbbbbbbb' } });
    expect(service.stop('guild-1', 'voice-guild-1')).toBe(true);
    expect(registry.size).toBe(0);
  });

  describe('listeners only', () => {
    beforeEach(async () => {
      await service.play(command('guild-1'));
      await flush();
    });

    it.each([
      ['another channel', 'voice-other'],
      ['no channel', undefined],
    ])('refuses controls from %s and changes nothing', (_, channelId) => {
      for (const control of ['pause', 'resume', 'skip', 'stop', 'shuffle', 'clear'] as const) {
        expect(() => service[control]('guild-1', channelId)).toThrow(NotListeningError);
      }
      expect(() => service.remove('guild-1', channelId, 1)).toThrow(NotListeningError);
      expect(() => service.move('guild-1', channelId, 1, 1)).toThrow(NotListeningError);
      expect(() => service.skipTo('guild-1', channelId, 1)).toThrow(NotListeningError);
      expect(registry.get('guild-1')?.state.status).toBe('playing');
    });

    it('shows the queue to anyone', () => {
      expect(service.nowPlaying('guild-1')).toMatchObject({ track: { id: 'aaaaaaaaaaa' } });
      expect(service.upcoming('guild-1')).toEqual([]);
    });

    describe('empty channel', () => {
      beforeEach(() => {
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      });

      afterEach(() => {
        vi.useRealTimers();
      });

      it('routes listener counts to the guild player', () => {
        service.updateListeners({ channelId: 'voice-guild-1', guildId: 'guild-2', listeners: 0 });
        expect(vi.getTimerCount()).toBe(0);

        service.updateListeners({ channelId: 'voice-guild-1', guildId: 'guild-1', listeners: 0 });
        vi.advanceTimersByTime(EMPTY_CHANNEL_TIMEOUT_MS);

        expect(registry.size).toBe(0);
        expect(voice.lastSession?.destroyed).toBe(true);
      });
    });

    it('refuses songs from another channel before any lookup', async () => {
      const other = command('guild-1', { voiceChannelId: 'voice-other' });

      await expect(service.play(other)).rejects.toThrow(NotListeningError);
      expect(resolver.calls).toHaveLength(1);
      expect(registry.get('guild-1')?.upcoming).toEqual([]);
    });

    it('follows Discord moving the bot', async () => {
      const session = voice.lastSession;
      if (session !== undefined) session.channelId = 'voice-other';

      expect(() => service.pause('guild-1', 'voice-guild-1')).toThrow(NotListeningError);
      expect(service.pause('guild-1', 'voice-other')).toBe(true);
      await expect(
        service.play(command('guild-1', { voiceChannelId: 'voice-other' })),
      ).resolves.toMatchObject({ status: 'queued' });
    });

    it('accepts any channel once the bot has left', async () => {
      expect(service.stop('guild-1', 'voice-guild-1')).toBe(true);

      await service.play(command('guild-1', { voiceChannelId: 'voice-other' }));
      expect(voice.calls.at(-1)?.target).toEqual({ channelId: 'voice-other', guildId: 'guild-1' });
    });
  });

  it('handles many guilds starting and stopping concurrently', async () => {
    const guilds = Array.from({ length: 20 }, (_, index) => `guild-${index}`);

    await Promise.all(
      guilds.map((guildId) => service.play(command(guildId, { requestedBy: `user-${guildId}` }))),
    );
    await flush();
    expect(registry.activeCount()).toBe(20);

    const stopped = guilds.filter((_, index) => index % 2 === 0);
    for (const guildId of stopped) expect(service.stop(guildId, `voice-${guildId}`)).toBe(true);

    expect(registry.activeCount()).toBe(10);
    for (const guildId of guilds) {
      expect(registry.get(guildId)?.state.status).toBe(
        stopped.includes(guildId) ? undefined : 'playing',
      );
    }
    expect(voice.sessions.filter(({ destroyed }) => destroyed)).toHaveLength(10);
  });
});
