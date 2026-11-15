import { Client, Events } from 'discord.js';
import { afterEach, describe, expect, it, vi } from 'vitest';

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
