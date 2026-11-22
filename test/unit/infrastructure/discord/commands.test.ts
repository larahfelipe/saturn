import { beforeEach, describe, expect, it } from 'vitest';

import {
  NotInVoiceChannelError,
  NotListeningError,
  QueuePositionError,
} from '../../../../src/application/errors.ts';
import { PlaybackService } from '../../../../src/application/music/PlaybackService.ts';
import { PlayerRegistry } from '../../../../src/application/music/PlayerRegistry.ts';
import { COMMAND_DEFINITIONS } from '../../../../src/infrastructure/discord/commandDefinitions.ts';
import {
  createCommandHandlers,
  runControl,
} from '../../../../src/infrastructure/discord/commands.ts';
import type { CommandContext } from '../../../../src/infrastructure/discord/commands.ts';
import { playbackControls } from '../../../../src/infrastructure/discord/replies.ts';
import {
  FakeResolver,
  FakeVoiceConnector,
  flush,
  RecordingLogger,
  trackUrl,
} from '../../../fixtures/fakes.ts';

const GUILD_ID = '123456789012345678';
const BOT = { avatarUrl: undefined, username: 'Saturn' };

interface ContextOverrides extends Partial<CommandContext> {
  readonly integers?: Readonly<Record<string, number>>;
  readonly url?: string;
}

function context(overrides: ContextOverrides = {}): CommandContext {
  const { integers = {}, url = trackUrl('aaaaaaaaaaa'), ...rest } = overrides;
  return {
    guildId: GUILD_ID,
    integerOption: (name) => integers[name],
    option: (name) => (name === 'url' ? url : undefined),
    userId: '42',
    voiceChannelId: 'voice-1',
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
      logger: new RecordingLogger(),
      resolver: new FakeResolver(),
      voice,
    });
    playback = new PlaybackService(registry);
    handlers = createCommandHandlers({
      bot: () => BOT,
      definitions: COMMAND_DEFINITIONS,
      heartbeatLatency: () => 37,
      playback,
    });
  });

  function upcomingIds(): string[] {
    return playback.upcoming(GUILD_ID).map(({ id }) => id);
  }

  describe('play', () => {
    it('defers, then reports the track that started playing with controls', async () => {
      expect(handlers.play.defer).toBe(true);

      const reply = await handlers.play.execute(context());

      expect(reply).toMatchObject({
        components: [playbackControls(GUILD_ID)],
        embeds: [
          {
            author: { name: 'Now playing' },
            description: 'Requested by <@42> Enjoy!',
            title: 'Track aaaaaaaaaaa',
          },
        ],
      });
      expect(voice.calls[0]?.target).toEqual({ channelId: 'voice-1', guildId: GUILD_ID });
    });

    it('reports the queue position when a track is already playing', async () => {
      await handlers.play.execute(context());

      const reply = await handlers.play.execute(context({ url: trackUrl('bbbbbbbbbbb') }));

      expect(reply.embeds).toEqual([
        expect.objectContaining({
          author: { name: 'Queued' },
          description: 'Added to the queue by <@42> at position 1',
          title: 'Track bbbbbbbbbbb',
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

  describe('playnext', () => {
    it('defers, then queues the track ahead of the others', async () => {
      expect(handlers.playnext.defer).toBe(true);
      await handlers.play.execute(context());
      await handlers.play.execute(context({ url: trackUrl('bbbbbbbbbbb') }));

      const reply = await handlers.playnext.execute(context({ url: trackUrl('ccccccccccc') }));

      expect(reply).toMatchObject({
        components: [playbackControls(GUILD_ID)],
        embeds: [{ description: 'Added to the queue by <@42> at position 1' }],
      });
      expect(upcomingIds()).toEqual(['ccccccccccc', 'bbbbbbbbbbb']);
    });

    it('rejects a missing URL without touching playback', async () => {
      const reply = await handlers.playnext.execute({ ...context(), option: () => undefined });

      expect(reply.embeds).toEqual([
        expect.objectContaining({ description: 'Missing song url option' }),
      ]);
      expect(registry.size).toBe(0);
    });
  });

  describe('nowplaying', () => {
    it('reports an idle player', async () => {
      expect(await handlers.nowplaying.execute(context())).toEqual({
        content: 'There is no song playing right now',
      });
    });

    it('shows the current song and its progress to anyone, with controls', async () => {
      await handlers.play.execute(context());
      await flush();
      const session = voice.lastSession;
      if (session !== undefined) session.elapsedMs = 71_000;

      const reply = await handlers.nowplaying.execute(context({ voiceChannelId: undefined }));

      expect(reply).toMatchObject({
        components: [playbackControls(GUILD_ID)],
        embeds: [
          {
            author: { name: 'Now playing' },
            description: 'Requested by <@42>',
            footer: { text: '━━━━━━●───────────── 1:11 / 3:33' },
            title: 'Track aaaaaaaaaaa',
          },
        ],
      });
    });
  });

  describe('queue', () => {
    it('reports an empty queue while idle', async () => {
      expect(await handlers.queue.execute(context())).toEqual({ content: 'The queue is empty' });
    });

    it('shows the requested page to anyone', async () => {
      for (let index = 0; index < 12; index++) {
        const id = `track${String(index).padStart(6, '0')}`;
        await handlers.play.execute(context({ url: trackUrl(id), userId: `user-${index}` }));
      }

      const reply = await handlers.queue.execute(
        context({ integers: { page: 2 }, voiceChannelId: undefined }),
      );

      expect(reply.embeds?.[0]?.description).toContain(
        '`11.` [Track track000011](https://www.youtube.com/watch?v=track000011)',
      );
      expect(reply.embeds?.[0]?.footer).toEqual({ text: 'Page 2/2 · 11 songs · 39:03 total' });
    });

    it('starts at the first page', async () => {
      await handlers.play.execute(context());
      await handlers.play.execute(context({ url: trackUrl('bbbbbbbbbbb') }));

      const reply = await handlers.queue.execute(context());

      expect(reply.embeds?.[0]?.footer).toEqual({ text: 'Page 1/1 · 1 song · 3:33 total' });
    });
  });

  describe('queue edits', () => {
    beforeEach(async () => {
      for (const id of ['aaaaaaaaaaa', 'bbbbbbbbbbb', 'ccccccccccc', 'ddddddddddd']) {
        await handlers.play.execute(context({ url: trackUrl(id) }));
      }
      await flush();
    });

    it('removes a song', async () => {
      const reply = await handlers.remove.execute(context({ integers: { position: 2 } }));

      expect(reply.embeds).toEqual([
        expect.objectContaining({
          description:
            'Removed [Track ccccccccccc](https://www.youtube.com/watch?v=ccccccccccc) from the queue',
        }),
      ]);
      expect(upcomingIds()).toEqual(['bbbbbbbbbbb', 'ddddddddddd']);
    });

    it('moves a song', async () => {
      const reply = await handlers.move.execute(context({ integers: { from: 3, to: 1 } }));

      expect(reply.embeds).toEqual([
        expect.objectContaining({
          description:
            'Moved [Track ddddddddddd](https://www.youtube.com/watch?v=ddddddddddd) to position 1',
        }),
      ]);
      expect(upcomingIds()).toEqual(['ddddddddddd', 'bbbbbbbbbbb', 'ccccccccccc']);
    });

    it('skips to a song', async () => {
      const reply = await handlers.skipto.execute(context({ integers: { position: 2 } }));
      await flush();

      expect(reply.embeds).toEqual([
        expect.objectContaining({
          description:
            'Skipped to [Track ccccccccccc](https://www.youtube.com/watch?v=ccccccccccc) ⏭️',
        }),
      ]);
      expect(registry.get(GUILD_ID)?.state).toMatchObject({ current: { id: 'ccccccccccc' } });
    });

    it('shuffles the queue', async () => {
      expect(await handlers.shuffle.execute(context())).toEqual({ content: 'Queue shuffled 🔀' });
      expect(upcomingIds().toSorted((a, b) => a.localeCompare(b))).toEqual([
        'bbbbbbbbbbb',
        'ccccccccccc',
        'ddddddddddd',
      ]);
    });

    it('clears the queue, then reports it empty', async () => {
      expect(await handlers.clear.execute(context())).toEqual({ content: 'Queue cleared 🧹' });
      expect(upcomingIds()).toEqual([]);

      expect(await handlers.clear.execute(context())).toEqual({ content: 'The queue is empty' });
      expect(await handlers.shuffle.execute(context())).toEqual({ content: 'The queue is empty' });
    });

    it.each(['remove', 'move', 'skipto'] as const)(
      'rejects %s without its positions',
      async (name) => {
        const reply = await handlers[name].execute(context());

        expect(reply.embeds).toEqual([
          expect.objectContaining({ description: 'Missing position option' }),
        ]);
        expect(upcomingIds()).toHaveLength(3);
      },
    );

    it.each([
      ['remove', { position: 1 }],
      ['move', { from: 1, to: 2 }],
      ['skipto', { position: 1 }],
      ['shuffle', {}],
      ['clear', {}],
    ] as const)("refuses %s from members outside the bot's voice channel", (name, integers) => {
      expect(() =>
        handlers[name].execute(context({ integers, voiceChannelId: 'voice-other' })),
      ).toThrow(NotListeningError);
      expect(upcomingIds()).toEqual(['bbbbbbbbbbb', 'ccccccccccc', 'ddddddddddd']);
    });

    it('propagates positions outside the queue to the interaction handler', () => {
      expect(() => handlers.remove.execute(context({ integers: { position: 4 } }))).toThrow(
        QueuePositionError,
      );
    });
  });

  describe.each(['pause', 'unpause', 'skip', 'stop'] as const)('%s', (name) => {
    it('reports an idle player', async () => {
      expect(await handlers[name].execute(context())).toEqual({
        content: 'There is no song playing right now',
      });
    });

    it("refuses members outside the bot's voice channel", async () => {
      await handlers.play.execute(context());

      expect(() => handlers[name].execute(context({ voiceChannelId: 'voice-other' }))).toThrow(
        NotListeningError,
      );
      expect(registry.get(GUILD_ID)?.state.status).toBe('playing');
    });
  });

  it('controls the guild playback', async () => {
    await handlers.play.execute(context());
    await handlers.play.execute(context({ url: trackUrl('bbbbbbbbbbb') }));
    await flush();

    expect(await handlers.pause.execute(context())).toEqual({
      content: 'Playback paused ⏸️',
    });
    expect(registry.get(GUILD_ID)?.state.status).toBe('paused');
    expect(await handlers.unpause.execute(context())).toEqual({
      content: 'Playback resumed ▶️',
    });
    expect(await handlers.skip.execute(context())).toEqual({ content: 'Song skipped ⏭️' });
    await flush();
    expect(registry.get(GUILD_ID)?.state).toMatchObject({ current: { id: 'bbbbbbbbbbb' } });
    expect(await handlers.stop.execute(context())).toEqual({
      content: 'Playback stopped 🛑',
    });
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
        '`/playnext` - Queue a YouTube video audio to play next',
        '`/pause` - Pause the currently playing song',
        '`/unpause` - Resume song playback',
        '`/skip` - Skip the currently playing song',
        '`/skipto` - Skip to a song in the queue',
        '`/stop` - Stop playback and clear the queue',
        '`/nowplaying` - Show the currently playing song and its progress',
        '`/queue` - Show the songs in the queue',
        '`/remove` - Remove a song from the queue',
        '`/move` - Move a song to another queue position',
        '`/shuffle` - Shuffle the queue',
        '`/clear` - Remove every song from the queue, keeping the current one',
        '`/ping` - Verify bot responsiveness',
        '`/health` - Check bot heartbeat latency',
        '`/help` - Show available commands list',
      ].join('\n'),
    );
  });
});

describe(runControl, () => {
  it('maps each control to its playback use case', () => {
    const calls: string[] = [];
    const record = (call: string): boolean => {
      calls.push(call);
      return true;
    };
    const playback = {
      pause: (guildId: string, channelId?: string) => record(`pause ${guildId} ${channelId}`),
      resume: (guildId: string, channelId?: string) => record(`resume ${guildId} ${channelId}`),
      skip: (guildId: string, channelId?: string) => record(`skip ${guildId} ${channelId}`),
      stop: (guildId: string, channelId?: string) => record(`stop ${guildId} ${channelId}`),
    } as unknown as PlaybackService;

    for (const control of ['pause', 'unpause', 'skip', 'stop'] as const) {
      expect(runControl(playback, control, 'g', 'v')).toBe(true);
    }
    expect(calls).toEqual(['pause g v', 'resume g v', 'skip g v', 'stop g v']);
  });
});
