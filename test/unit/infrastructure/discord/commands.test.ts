import { beforeEach, describe, expect, it } from 'vitest';

import { NotInVoiceChannelError } from '../../../../src/application/errors.ts';
import { PlaybackService } from '../../../../src/application/music/PlaybackService.ts';
import { PlayerRegistry } from '../../../../src/application/music/PlayerRegistry.ts';
import { COMMAND_DEFINITIONS } from '../../../../src/infrastructure/discord/commandDefinitions.ts';
import {
  createCommandHandlers,
  runControl,
  type CommandContext,
} from '../../../../src/infrastructure/discord/commands.ts';
import { playbackControls } from '../../../../src/infrastructure/discord/replies.ts';
import {
  FakeResolver,
  FakeVoiceConnector,
  flush,
  RecordingLogger,
  trackUrl,
} from '../../../fixtures/fakes.ts';

const GUILD_ID = '123456789012345678';
const BOT = { username: 'Saturn', avatarUrl: undefined };

function context(overrides: Partial<CommandContext> & { url?: string } = {}): CommandContext {
  const { url = trackUrl('aaaaaaaaaaa'), ...rest } = overrides;
  return {
    guildId: GUILD_ID,
    userId: '42',
    voiceChannelId: 'voice-1',
    option: (name) => (name === 'url' ? url : undefined),
    ...rest,
  };
}

describe('command handlers', () => {
  let voice: FakeVoiceConnector;
  let registry: PlayerRegistry;
  let playback: PlaybackService;
  let handlers: ReturnType<typeof createCommandHandlers>;

  beforeEach(() => {
    voice = new FakeVoiceConnector();
    registry = new PlayerRegistry({
      resolver: new FakeResolver(),
      voice,
      logger: new RecordingLogger(),
    });
    playback = new PlaybackService(registry);
    handlers = createCommandHandlers({
      playback,
      definitions: COMMAND_DEFINITIONS,
      bot: () => BOT,
      heartbeatLatency: () => 37,
    });
  });

  describe('play', () => {
    it('defers, then reports the track that started playing with controls', async () => {
      expect(handlers.play.defer).toBe(true);

      const reply = await handlers.play.execute(context());

      expect(reply).toMatchObject({
        embeds: [
          {
            author: { name: 'Now playing' },
            title: 'Track aaaaaaaaaaa',
            description: 'Requested by <@42> Enjoy!',
          },
        ],
        components: [playbackControls(GUILD_ID)],
      });
      expect(voice.calls[0]?.target).toEqual({ guildId: GUILD_ID, channelId: 'voice-1' });
    });

    it('reports the queue position when a track is already playing', async () => {
      await handlers.play.execute(context());

      const reply = await handlers.play.execute(context({ url: trackUrl('bbbbbbbbbbb') }));

      expect(reply.embeds).toEqual([
        expect.objectContaining({
          author: { name: 'Queued' },
          title: 'Track bbbbbbbbbbb',
          description: 'Added to the queue by <@42> at position 1',
        }),
      ]);
    });

    it('rejects a missing URL without touching playback', async () => {
      const reply = await handlers.play.execute({ ...context(), option: () => undefined });

      expect(reply.embeds).toEqual([
        expect.objectContaining({ description: 'Missing song url option' }),
      ]);
      expect(registry.size).toBe(0);
    });

    it('propagates playback errors to the interaction handler', async () => {
      await expect(handlers.play.execute(context({ voiceChannelId: undefined }))).rejects.toThrow(
        NotInVoiceChannelError,
      );
    });
  });

  describe.each(['pause', 'unpause', 'skip', 'stop'] as const)('%s', (name) => {
    it('reports an idle player', async () => {
      expect(await handlers[name].execute(context())).toEqual({
        content: 'There is no song playing right now',
      });
    });
  });

  it('controls the guild playback', async () => {
    await handlers.play.execute(context());
    await handlers.play.execute(context({ url: trackUrl('bbbbbbbbbbb') }));
    await flush();

    expect(await handlers.pause.execute(context())).toEqual({ content: 'Playback paused ⏸️' });
    expect(registry.get(GUILD_ID)?.state.status).toBe('paused');
    expect(await handlers.unpause.execute(context())).toEqual({
      content: 'Playback resumed ▶️',
    });
    expect(await handlers.skip.execute(context())).toEqual({ content: 'Song skipped ⏭️' });
    await flush();
    expect(registry.get(GUILD_ID)?.state).toMatchObject({ current: { id: 'bbbbbbbbbbb' } });
    expect(await handlers.stop.execute(context())).toEqual({ content: 'Playback stopped 🛑' });
    expect(registry.size).toBe(0);
    expect(voice.lastSession?.destroyed).toBe(true);
  });

  it('answers ping', async () => {
    expect(await handlers.ping.execute(context())).toEqual({ content: 'Pong! 🏓' });
  });

  it('reports the heartbeat latency', async () => {
    const reply = await handlers.health.execute(context());

    expect(reply.embeds).toEqual([
      expect.objectContaining({ description: 'Heartbeat latency: 37ms' }),
    ]);
  });

  it('lists every command in registration order', async () => {
    const reply = await handlers.help.execute(context());

    expect(reply.embeds?.[0]?.description).toBe(
      [
        'Available slash commands:',
        '`/play` - Play a YouTube video audio',
        '`/pause` - Pause the currently playing song',
        '`/unpause` - Resume song playback',
        '`/skip` - Skip the currently playing song',
        '`/stop` - Stop playback and clear the queue',
        '`/ping` - Verify bot responsiveness',
        '`/health` - Check bot heartbeat latency',
        '`/help` - Show available commands list',
      ].join('\n'),
    );
  });
});

describe('runControl', () => {
  it('maps each control to its playback use case', () => {
    const calls: string[] = [];
    const playback = {
      pause: (guildId: string) => calls.push(`pause ${guildId}`) > 0,
      resume: (guildId: string) => calls.push(`resume ${guildId}`) > 0,
      skip: (guildId: string) => calls.push(`skip ${guildId}`) > 0,
      stop: (guildId: string) => calls.push(`stop ${guildId}`) > 0,
    } as unknown as PlaybackService;

    for (const control of ['pause', 'unpause', 'skip', 'stop'] as const) {
      expect(runControl(playback, control, 'g')).toBe(true);
    }
    expect(calls).toEqual(['pause g', 'resume g', 'skip g', 'stop g']);
  });
});
