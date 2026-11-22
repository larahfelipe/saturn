import { ChannelType, Client, Collection, Events } from 'discord.js';
import type { ClientUser, Guild, VoiceState } from 'discord.js';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { VoiceChannelUnusableError } from '../../../../src/application/errors.ts';
import type { ListenerUpdate } from '../../../../src/application/music/PlaybackService.ts';
import { COMMAND_DEFINITIONS } from '../../../../src/infrastructure/discord/commandDefinitions.ts';
import type { CommandName } from '../../../../src/infrastructure/discord/commandDefinitions.ts';
import { CommandRegistry } from '../../../../src/infrastructure/discord/CommandRegistry.ts';
import type { CommandHandler } from '../../../../src/infrastructure/discord/commands.ts';
import { DiscordClient } from '../../../../src/infrastructure/discord/DiscordClient.ts';
import { RecordingLogger } from '../../../fixtures/fakes.ts';
import { GUILD_ID, VOICE_CHANNEL_ID } from '../../../fixtures/interactions.ts';

const BOT_ID = '400000000000000001';
const OTHER_CHANNEL_ID = '200000000000000002';

interface FakeVoiceState {
  readonly channelId: string | null;
  readonly id: string;
  readonly member: { readonly user: { readonly bot: boolean } } | null;
}

function commands(): CommandRegistry {
  const handler: CommandHandler = { execute: () => ({ content: 'ok' }) };
  const handlers = Object.fromEntries(COMMAND_DEFINITIONS.map(({ name }) => [name, handler]));
  return new CommandRegistry(COMMAND_DEFINITIONS, handlers as Record<CommandName, CommandHandler>);
}

function inVoice(id: string, channelId: string | null, bot = false): FakeVoiceState {
  return { channelId, id, member: { user: { bot } } };
}

describe(DiscordClient, () => {
  let discord: DiscordClient;
  let client: Client;
  let logger: RecordingLogger;

  function create(): DiscordClient {
    const on = vi.spyOn(Client.prototype, 'on');
    logger = new RecordingLogger();
    discord = new DiscordClient({ activityStatus: undefined, logger, token: 'test-token' });
    client = on.mock.contexts[0] as Client;
    on.mockRestore();
    return discord;
  }

  afterEach(async () => {
    await discord.stop();
  });

  it('falls back to the default profile before connecting', () => {
    expect(create().botProfile).toEqual({ avatarUrl: undefined, username: 'Saturn' });
  });

  it('finds no voice channel in a guild it is not in', () => {
    expect(
      create().voiceChannel({ channelId: VOICE_CHANNEL_ID, guildId: GUILD_ID }),
    ).toBeUndefined();
  });

  describe('voice channel checks', () => {
    const target = { channelId: VOICE_CHANNEL_ID, guildId: GUILD_ID };
    const adapterCreator = vi.fn();

    interface ChannelSetup {
      readonly afk?: boolean;
      readonly full?: boolean;
      readonly joinable?: boolean;
      readonly memberCached?: boolean;
      readonly speakable?: boolean;
      readonly type?: ChannelType;
    }

    function withChannel(setup: ChannelSetup = {}): DiscordClient {
      const discord = create();
      const channel = {
        bitrate: 96_000,
        full: setup.full ?? false,
        id: VOICE_CHANNEL_ID,
        isVoiceBased: () => true,
        joinable: setup.joinable ?? true,
        speakable: setup.speakable ?? true,
        type: setup.type ?? ChannelType.GuildVoice,
      };
      const guild = {
        afkChannelId: setup.afk === true ? VOICE_CHANNEL_ID : null,
        channels: { cache: new Collection([[VOICE_CHANNEL_ID, channel]]) },
        id: GUILD_ID,
        members: { me: setup.memberCached === false ? null : {} },
        voiceAdapterCreator: adapterCreator,
      };
      client.guilds.cache.set(GUILD_ID, guild as unknown as Guild);
      return discord;
    }

    it('returns a channel the bot can join and speak in', () => {
      expect(withChannel().voiceChannel(target)).toEqual({ adapterCreator, bitrate: 96_000 });
    });

    it.each([
      ['a stage channel', { type: ChannelType.GuildStageVoice }, 'stage'],
      ['the AFK channel', { afk: true }, 'afk'],
      ['a full channel', { full: true, joinable: false }, 'full'],
      ['a channel it cannot join', { joinable: false }, 'missing-permissions'],
      ['a channel it cannot speak in', { speakable: false }, 'missing-permissions'],
    ] as const)('refuses %s', (_, setup, problem) => {
      const discord = withChannel(setup);

      expect(() => discord.voiceChannel(target)).toThrow(VoiceChannelUnusableError);
      expect(() => discord.voiceChannel(target)).toThrow(expect.objectContaining({ problem }));
    });

    it('leaves permissions to the join while its own member is not cached', () => {
      expect(withChannel({ joinable: false, memberCached: false }).voiceChannel(target)).toEqual({
        adapterCreator,
        bitrate: 96_000,
      });
    });
  });

  describe('listener updates', () => {
    let updates: ListenerUpdate[];
    let guild: {
      readonly id: string;
      readonly voiceStates: { cache: Collection<string, unknown> };
    };

    function withVoiceStates(...states: FakeVoiceState[]): void {
      create();
      client.user = { id: BOT_ID } as ClientUser;
      guild = {
        id: GUILD_ID,
        voiceStates: { cache: new Collection(states.map((state) => [state.id, state])) },
      };
      updates = [];
      discord.onListenersChange((update) => {
        updates.push(update);
      });
    }

    function emitMove(id: string, from: string | null, to: string | null): void {
      const state = (channelId: string | null) =>
        ({ channelId, guild, id }) as unknown as VoiceState;
      client.emit(Events.VoiceStateUpdate, state(from), state(to));
    }

    it('reports the listeners left when a member leaves the bot channel', () => {
      withVoiceStates(
        inVoice(BOT_ID, VOICE_CHANNEL_ID),
        inVoice('member-1', VOICE_CHANNEL_ID),
        inVoice('member-2', null),
      );

      emitMove('member-2', VOICE_CHANNEL_ID, null);

      expect(updates).toEqual([{ channelId: VOICE_CHANNEL_ID, guildId: GUILD_ID, listeners: 1 }]);
    });

    it('reports a member joining the bot channel', () => {
      withVoiceStates(inVoice(BOT_ID, VOICE_CHANNEL_ID), inVoice('member-1', VOICE_CHANNEL_ID));

      emitMove('member-1', OTHER_CHANNEL_ID, VOICE_CHANNEL_ID);

      expect(updates).toEqual([{ channelId: VOICE_CHANNEL_ID, guildId: GUILD_ID, listeners: 1 }]);
    });

    it('reports the channel the bot joins or is moved to', () => {
      withVoiceStates(inVoice(BOT_ID, OTHER_CHANNEL_ID), inVoice('member-1', VOICE_CHANNEL_ID));

      emitMove(BOT_ID, VOICE_CHANNEL_ID, OTHER_CHANNEL_ID);
      emitMove(BOT_ID, null, OTHER_CHANNEL_ID);

      expect(updates).toEqual([
        { channelId: OTHER_CHANNEL_ID, guildId: GUILD_ID, listeners: 0 },
        { channelId: OTHER_CHANNEL_ID, guildId: GUILD_ID, listeners: 0 },
      ]);
    });

    it('does not count other bots, but counts members it does not know', () => {
      withVoiceStates(
        inVoice(BOT_ID, VOICE_CHANNEL_ID),
        inVoice('other-bot', VOICE_CHANNEL_ID, true),
        { channelId: VOICE_CHANNEL_ID, id: 'uncached', member: null },
        inVoice('member-1', null),
      );

      emitMove('member-1', VOICE_CHANNEL_ID, null);

      expect(updates).toEqual([{ channelId: VOICE_CHANNEL_ID, guildId: GUILD_ID, listeners: 1 }]);
    });

    it('ignores changes that do not move anyone into or out of the bot channel', () => {
      withVoiceStates(inVoice(BOT_ID, VOICE_CHANNEL_ID), inVoice('member-1', OTHER_CHANNEL_ID));

      emitMove('member-1', null, OTHER_CHANNEL_ID);
      emitMove('member-1', VOICE_CHANNEL_ID, VOICE_CHANNEL_ID);

      expect(updates).toEqual([]);
    });

    it('ignores changes while the bot is in no voice channel', () => {
      withVoiceStates(inVoice(BOT_ID, null), inVoice('member-1', null));

      emitMove('member-1', VOICE_CHANNEL_ID, null);
      emitMove(BOT_ID, VOICE_CHANNEL_ID, null);

      expect(updates).toEqual([]);
    });
  });

  it('propagates a failed login without synchronizing commands', async () => {
    const error = new Error('An invalid token was provided.');
    const login = vi.spyOn(Client.prototype, 'login').mockRejectedValue(error);
    const registry = commands();
    const sync = vi.spyOn(registry, 'sync');

    await expect(create().start(registry)).rejects.toBe(error);

    expect(login).toHaveBeenCalledWith('test-token');
    expect(sync).not.toHaveBeenCalled();
  });

  it('reports a gateway close that discord.js will not reconnect from', () => {
    const lost: number[] = [];
    create().onGatewayLost((code) => {
      lost.push(code);
    });

    client.emit(Events.ShardDisconnect, new CloseEvent('close', { code: 4004 }), 0);

    expect(lost).toEqual([4004]);
    expect(logger.contextOf('error', 'discord gateway closed permanently')).toEqual({
      code: 4004,
      shardId: 0,
    });
  });

  it('logs gateway reconnects', () => {
    create();

    client.emit(Events.ShardReconnecting, 0);

    expect(logger.contextOf('warn', 'discord gateway reconnecting')).toEqual({ shardId: 0 });
  });

  it('ignores gateway closes caused by stopping', async () => {
    const lost: number[] = [];
    create().onGatewayLost((code) => {
      lost.push(code);
    });
    await discord.stop();

    client.emit(Events.ShardReconnecting, 0);
    client.emit(Events.ShardDisconnect, new CloseEvent('close', { code: 4004 }), 0);

    expect(lost).toEqual([]);
    expect(logger.entries).toEqual([]);
  });

  it('stops idempotently', async () => {
    await create().stop();

    await expect(discord.stop()).resolves.toBeUndefined();
  });
});
