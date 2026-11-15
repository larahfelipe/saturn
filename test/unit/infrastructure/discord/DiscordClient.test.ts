import { ChannelType, Client, Collection, Events, type Guild } from 'discord.js';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { VoiceChannelUnusableError } from '../../../../src/application/errors.ts';
import { CommandRegistry } from '../../../../src/infrastructure/discord/CommandRegistry.ts';
import {
  COMMAND_DEFINITIONS,
  type CommandName,
} from '../../../../src/infrastructure/discord/commandDefinitions.ts';
import type { CommandHandler } from '../../../../src/infrastructure/discord/commands.ts';
import { DiscordClient } from '../../../../src/infrastructure/discord/DiscordClient.ts';
import { RecordingLogger } from '../../../fixtures/fakes.ts';
import { GUILD_ID, VOICE_CHANNEL_ID } from '../../../fixtures/interactions.ts';

function commands(): CommandRegistry {
  const handler: CommandHandler = { execute: () => ({ content: 'ok' }) };
  const handlers = Object.fromEntries(COMMAND_DEFINITIONS.map(({ name }) => [name, handler]));
  return new CommandRegistry(COMMAND_DEFINITIONS, handlers as Record<CommandName, CommandHandler>);
}

describe('DiscordClient', () => {
  let discord: DiscordClient;
  let client: Client;
  let logger: RecordingLogger;

  function create(): DiscordClient {
    const on = vi.spyOn(Client.prototype, 'on');
    logger = new RecordingLogger();
    discord = new DiscordClient({ token: 'test-token', activityStatus: undefined, logger });
    client = on.mock.contexts[0] as Client;
    on.mockRestore();
    return discord;
  }

  afterEach(async () => {
    await discord.stop();
  });

  it('falls back to the default profile before connecting', () => {
    expect(create().botProfile).toEqual({ username: 'Saturn', avatarUrl: undefined });
  });

  it('finds no voice channel in a guild it is not in', () => {
    expect(create().voiceChannel({ guildId: GUILD_ID, channelId: VOICE_CHANNEL_ID })).toBe(
      undefined,
    );
  });

  describe('voice channel checks', () => {
    const target = { guildId: GUILD_ID, channelId: VOICE_CHANNEL_ID };
    const adapterCreator = vi.fn();

    interface ChannelSetup {
      readonly type?: ChannelType;
      readonly afk?: boolean;
      readonly joinable?: boolean;
      readonly full?: boolean;
      readonly speakable?: boolean;
      readonly memberCached?: boolean;
    }

    function withChannel(setup: ChannelSetup = {}): DiscordClient {
      const discord = create();
      const channel = {
        id: VOICE_CHANNEL_ID,
        type: setup.type ?? ChannelType.GuildVoice,
        bitrate: 96_000,
        joinable: setup.joinable ?? true,
        full: setup.full ?? false,
        speakable: setup.speakable ?? true,
        isVoiceBased: () => true,
      };
      const guild = {
        id: GUILD_ID,
        afkChannelId: setup.afk === true ? VOICE_CHANNEL_ID : null,
        members: { me: setup.memberCached === false ? null : {} },
        voiceAdapterCreator: adapterCreator,
        channels: { cache: new Collection([[VOICE_CHANNEL_ID, channel]]) },
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
      ['a full channel', { joinable: false, full: true }, 'full'],
      ['a channel it cannot join', { joinable: false }, 'missing-permissions'],
      ['a channel it cannot speak in', { speakable: false }, 'missing-permissions'],
    ] as const)('refuses %s', (_, setup, problem) => {
      const discord = withChannel(setup);

      expect(() => discord.voiceChannel(target)).toThrow(VoiceChannelUnusableError);
      expect(() => discord.voiceChannel(target)).toThrow(expect.objectContaining({ problem }));
    });

    it('leaves permissions to the join while its own member is not cached', () => {
      expect(withChannel({ memberCached: false, joinable: false }).voiceChannel(target)).toEqual({
        adapterCreator,
        bitrate: 96_000,
      });
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
    create().onGatewayLost((code) => lost.push(code));

    client.emit(Events.ShardDisconnect, new CloseEvent('close', { code: 4004 }), 0);

    expect(lost).toEqual([4004]);
    expect(logger.contextOf('error', 'discord gateway closed permanently')).toEqual({
      shardId: 0,
      code: 4004,
    });
  });

  it('logs gateway reconnects', () => {
    create();

    client.emit(Events.ShardReconnecting, 0);

    expect(logger.contextOf('warn', 'discord gateway reconnecting')).toEqual({ shardId: 0 });
  });

  it('ignores gateway closes caused by stopping', async () => {
    const lost: number[] = [];
    create().onGatewayLost((code) => lost.push(code));
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
