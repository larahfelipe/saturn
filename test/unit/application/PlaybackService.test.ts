import { beforeEach, describe, expect, it } from 'vitest';

import { NotInVoiceChannelError } from '../../../src/application/errors.ts';
import {
  PlaybackService,
  type PlayCommand,
} from '../../../src/application/music/PlaybackService.ts';
import { PlayerRegistry } from '../../../src/application/music/PlayerRegistry.ts';
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

  it('plays in the requester voice channel', async () => {
    await expect(service.play(command('guild-1'))).resolves.toMatchObject({ status: 'playing' });

    expect(resolver.calls[0]?.request).toEqual({
      url: trackUrl('aaaaaaaaaaa'),
      requestedBy: 'user',
    });
    expect(voice.calls[0]?.target).toEqual({ guildId: 'guild-1', channelId: 'voice-guild-1' });
  });

  it('reports controls on guilds without a player as unsuccessful', () => {
    expect(service.pause('guild-1')).toBe(false);
    expect(service.resume('guild-1')).toBe(false);
    expect(service.skip('guild-1')).toBe(false);
    expect(service.stop('guild-1')).toBe(false);
    expect(registry.size).toBe(0);
  });

  it('routes controls to the guild player', async () => {
    await service.play(command('guild-1'));
    await service.play(command('guild-1', { url: trackUrl('bbbbbbbbbbb') }));
    await flush();

    expect(service.pause('guild-1')).toBe(true);
    expect(registry.get('guild-1')?.state.status).toBe('paused');
    expect(service.resume('guild-1')).toBe(true);
    expect(service.skip('guild-1')).toBe(true);
    await flush();
    expect(registry.get('guild-1')?.state).toMatchObject({ current: { id: 'bbbbbbbbbbb' } });
    expect(service.stop('guild-1')).toBe(true);
    expect(registry.size).toBe(0);
  });

  it('handles many guilds starting and stopping concurrently', async () => {
    const guilds = Array.from({ length: 20 }, (_, index) => `guild-${index}`);

    await Promise.all(guilds.map((guildId) => service.play(command(guildId))));
    await flush();
    expect(registry.activeCount()).toBe(20);

    const stopped = guilds.filter((_, index) => index % 2 === 0);
    for (const guildId of stopped) expect(service.stop(guildId)).toBe(true);

    expect(registry.activeCount()).toBe(10);
    for (const guildId of guilds) {
      expect(registry.get(guildId)?.state.status).toBe(
        stopped.includes(guildId) ? undefined : 'playing',
      );
    }
    expect(voice.sessions.filter(({ destroyed }) => destroyed)).toHaveLength(10);
  });
});
