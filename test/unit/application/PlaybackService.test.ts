import { beforeEach, describe, expect, it } from 'vitest';

import {
  NotInVoiceChannelError,
  NotListeningError,
  RateLimitedError,
} from '../../../src/application/errors.ts';
import {
  PlaybackService,
  type PlayCommand,
} from '../../../src/application/music/PlaybackService.ts';
import { PlayerRegistry } from '../../../src/application/music/PlayerRegistry.ts';
import { RateLimiter } from '../../../src/application/RateLimiter.ts';
import {
  FakeResolver,
  FakeVoiceConnector,
  flush,
  RecordingLogger,
  trackUrl,
} from '../../fixtures/fakes.ts';

function command(guildId: string, overrides: Partial<PlayCommand> = {}): PlayCommand {
  return {
    guildId,
    url: trackUrl('aaaaaaaaaaa'),
    requestedBy: 'user',
    voiceChannelId: `voice-${guildId}`,
    ...overrides,
  };
}

describe('PlaybackService', () => {
  let resolver: FakeResolver;
  let voice: FakeVoiceConnector;
  let registry: PlayerRegistry;
  let service: PlaybackService;

  beforeEach(() => {
    resolver = new FakeResolver();
    voice = new FakeVoiceConnector();
    registry = new PlayerRegistry({ resolver, voice, logger: new RecordingLogger() });
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
        playLimiter: new RateLimiter({ limit: 2, windowMs: 10_000, now: () => now }),
      });
    });

    it('refuses a user who requests too often, before any lookup', async () => {
      await service.play(command('guild-1'));
      now += 4_000;
      await service.play(command('guild-1'));

      await expect(service.play(command('guild-2'))).rejects.toThrow(
        expect.objectContaining({ name: RateLimitedError.name, retryAfterMs: 6_000 }),
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
      url: trackUrl('aaaaaaaaaaa'),
      requestedBy: 'user',
    });
    expect(voice.calls[0]?.target).toEqual({ guildId: 'guild-1', channelId: 'voice-guild-1' });
  });

  it('reports controls on guilds without a player as unsuccessful', () => {
    expect(service.pause('guild-1', 'voice-guild-1')).toBe(false);
    expect(service.resume('guild-1', 'voice-guild-1')).toBe(false);
    expect(service.skip('guild-1', 'voice-guild-1')).toBe(false);
    expect(service.stop('guild-1', 'voice-guild-1')).toBe(false);
    expect(registry.size).toBe(0);
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
      for (const control of ['pause', 'resume', 'skip', 'stop'] as const) {
        expect(() => service[control]('guild-1', channelId)).toThrow(NotListeningError);
      }
      expect(registry.get('guild-1')?.state.status).toBe('playing');
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
      expect(voice.calls.at(-1)?.target).toEqual({ guildId: 'guild-1', channelId: 'voice-other' });
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
