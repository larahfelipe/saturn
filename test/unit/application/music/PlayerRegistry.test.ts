import { beforeEach, describe, expect, it } from 'vitest';

import {
  PlayerUnavailableError,
  TrackUnavailableError,
} from '../../../../src/application/errors.ts';
import type { PlayRequest } from '../../../../src/application/music/GuildPlayer.ts';
import { PlayerRegistry } from '../../../../src/application/music/PlayerRegistry.ts';
import {
  FakeResolver,
  FakeVoiceConnector,
  flush,
  RecordingLogger,
  trackUrl,
} from '../../../fixtures/fakes.ts';

const REQUEST: PlayRequest = {
  requestedBy: 'user',
  url: trackUrl('aaaaaaaaaaa'),
  voiceChannelId: 'voice-1',
};

describe(PlayerRegistry, () => {
  let resolver: FakeResolver;
  let voice: FakeVoiceConnector;
  let logger: RecordingLogger;
  let registry: PlayerRegistry;

  beforeEach(() => {
    resolver = new FakeResolver();
    voice = new FakeVoiceConnector();
    logger = new RecordingLogger();
    registry = new PlayerRegistry({ logger, resolver, voice });
  });

  it('keeps one player per guild', () => {
    const first = registry.acquire('guild-1');

    expect(registry.acquire('guild-1')).toBe(first);
    expect(registry.acquire('guild-2')).not.toBe(first);
    expect(registry.get('guild-1')).toBe(first);
    expect(registry.get('guild-3')).toBeUndefined();
    expect(registry.size).toBe(2);
  });

  it('binds the guild ID to player logs', async () => {
    await registry.acquire('guild-1').play(REQUEST);

    expect(logger.entries.length).toBeGreaterThan(0);
    expect(logger.entries.every(({ context }) => context.guildId === 'guild-1')).toBe(true);
  });

  it('releases and disposes a player when its queue drains', async () => {
    const player = registry.acquire('guild-1');
    await player.play(REQUEST);
    await flush();

    voice.lastSession?.current?.finish();
    await flush();

    expect(registry.get('guild-1')).toBeUndefined();
    expect(player.isDisposed).toBe(true);
  });

  it('releases a player whose only request failed', async () => {
    resolver.failWith = new TrackUnavailableError('PRIVATE');
    const player = registry.acquire('guild-1');

    await expect(player.play(REQUEST)).rejects.toThrow(TrackUnavailableError);

    expect(registry.size).toBe(0);
    expect(player.isDisposed).toBe(true);
  });

  it('keeps a player that is still playing when another request fails', async () => {
    const player = registry.acquire('guild-1');
    await player.play(REQUEST);
    resolver.failWith = new TrackUnavailableError('PRIVATE');

    await expect(player.play(REQUEST)).rejects.toThrow(TrackUnavailableError);

    expect(registry.get('guild-1')).toBe(player);
  });

  it('creates a fresh player after a stop released the previous one', async () => {
    const first = registry.acquire('guild-1');
    await first.play(REQUEST);
    first.stop();

    const second = registry.acquire('guild-1');

    expect(second).not.toBe(first);
    await expect(second.play(REQUEST)).resolves.toMatchObject({ status: 'playing' });
  });

  it('counts players that hold playback resources', async () => {
    voice.manual = true;
    void registry
      .acquire('guild-1')
      .play(REQUEST)
      .catch(() => undefined);
    registry.acquire('guild-2');
    expect(registry.activeCount()).toBe(0);

    await flush();
    expect(registry.activeCount()).toBe(1);

    registry.get('guild-1')?.stop();
    expect(registry.activeCount()).toBe(0);
  });

  it('isolates guilds from each other', async () => {
    const one = registry.acquire('guild-1');
    const two = registry.acquire('guild-2');
    await Promise.all([one.play(REQUEST), two.play(REQUEST)]);
    await flush();

    one.stop();

    expect(two.state.status).toBe('playing');
    expect(voice.sessions.map(({ destroyed }) => destroyed)).toEqual([true, false]);
    expect(registry.activeCount()).toBe(1);
  });

  describe('close', () => {
    it('disposes every player and rejects new ones', async () => {
      const one = registry.acquire('guild-1');
      await one.play(REQUEST);
      resolver.manual = true;
      const pending = registry.acquire('guild-2').play(REQUEST);
      await flush();

      registry.close();
      registry.close();

      expect(registry.isClosed).toBe(true);
      expect(registry.size).toBe(0);
      expect(one.isDisposed).toBe(true);
      expect(voice.lastSession?.destroyed).toBe(true);
      await expect(pending).rejects.toThrow(PlayerUnavailableError);
      expect(() => registry.acquire('guild-3')).toThrow(PlayerUnavailableError);
    });
  });
});
