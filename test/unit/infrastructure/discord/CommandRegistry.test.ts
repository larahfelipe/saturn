import { ApplicationCommandOptionType, InteractionContextType } from 'discord.js';
import { describe, expect, it } from 'vitest';

import { COMMAND_DEFINITIONS } from '../../../../src/infrastructure/discord/commandDefinitions.ts';
import type { CommandName } from '../../../../src/infrastructure/discord/commandDefinitions.ts';
import { CommandRegistry } from '../../../../src/infrastructure/discord/CommandRegistry.ts';
import type { CommandHandler } from '../../../../src/infrastructure/discord/commands.ts';

function handlers(): Record<CommandName, CommandHandler> {
  const reply = (content: string): CommandHandler => ({ execute: () => ({ content }) });
  return {
    health: reply('health'),
    help: reply('help'),
    pause: reply('pause'),
    ping: reply('ping'),
    play: { defer: true, execute: () => ({ content: 'play' }) },
    skip: reply('skip'),
    stop: reply('stop'),
    unpause: reply('unpause'),
  };
}

describe('command definitions', () => {
  it('defines the eight Go commands in registration order', () => {
    expect(COMMAND_DEFINITIONS.map(({ description, name }) => [name, description])).toEqual([
      ['play', 'Play a YouTube video audio'],
      ['pause', 'Pause the currently playing song'],
      ['unpause', 'Resume song playback'],
      ['skip', 'Skip the currently playing song'],
      ['stop', 'Stop playback and clear the queue'],
      ['ping', 'Verify bot responsiveness'],
      ['health', 'Check bot heartbeat latency'],
      ['help', 'Show available commands list'],
    ]);
  });

  it('makes every command guild-only', () => {
    for (const definition of COMMAND_DEFINITIONS) {
      expect(definition.contexts).toEqual([InteractionContextType.Guild]);
    }
  });

  it('requires the play URL option', () => {
    const play = COMMAND_DEFINITIONS.find(({ name }) => name === 'play');

    expect(play?.options).toEqual([
      expect.objectContaining({
        description: 'The YouTube video URL',
        name: 'url',
        required: true,
        type: ApplicationCommandOptionType.String,
      }),
    ]);
  });
});

describe(CommandRegistry, () => {
  it('pairs each definition with its handler', async () => {
    const registry = new CommandRegistry(COMMAND_DEFINITIONS, handlers());

    expect(registry.definitions).toEqual(COMMAND_DEFINITIONS);
    expect(registry.get('play')).toMatchObject({ defer: true, definition: { name: 'play' } });
    expect(await registry.get('ping')?.execute(undefined as never)).toEqual({
      content: 'ping',
    });
    expect(registry.get('unknown')).toBeUndefined();
  });

  it('rejects duplicate definitions', () => {
    const [play] = COMMAND_DEFINITIONS;
    if (play === undefined) throw new Error('missing play definition');

    expect(() => new CommandRegistry([play, play], handlers())).toThrow(
      'Duplicate command definition "play"',
    );
  });

  it('overwrites the application commands with every definition', async () => {
    const registry = new CommandRegistry(COMMAND_DEFINITIONS, handlers());
    const calls: unknown[] = [];

    await registry.sync({
      set: (commands) => {
        calls.push(commands);
        return Promise.resolve();
      },
    });

    expect(calls).toEqual([COMMAND_DEFINITIONS]);
  });
});
