import { ApplicationCommandOptionType, InteractionContextType } from 'discord.js';
import { describe, expect, it } from 'vitest';

import { COMMAND_DEFINITIONS } from '../../../../src/infrastructure/discord/commandDefinitions.ts';
import type {
  CommandDefinition,
  CommandName,
} from '../../../../src/infrastructure/discord/commandDefinitions.ts';
import { CommandRegistry } from '../../../../src/infrastructure/discord/CommandRegistry.ts';
import type { CommandHandler } from '../../../../src/infrastructure/discord/commands.ts';

function handlers(): Record<CommandName, CommandHandler> {
  const reply = (content: string): CommandHandler => ({ execute: () => ({ content }) });
  return {
    clear: reply('clear'),
    health: reply('health'),
    help: reply('help'),
    move: reply('move'),
    nowplaying: reply('nowplaying'),
    pause: reply('pause'),
    ping: reply('ping'),
    play: { defer: true, execute: () => ({ content: 'play' }) },
    playnext: { defer: true, execute: () => ({ content: 'playnext' }) },
    queue: reply('queue'),
    remove: reply('remove'),
    shuffle: reply('shuffle'),
    skip: reply('skip'),
    skipto: reply('skipto'),
    stop: reply('stop'),
    unpause: reply('unpause'),
  };
}

function optionsOf(command: CommandName): CommandDefinition['options'] {
  return COMMAND_DEFINITIONS.find(({ name }) => name === command)?.options;
}

describe('command definitions', () => {
  it('defines every command in registration order', () => {
    expect(COMMAND_DEFINITIONS.map(({ description, name }) => [name, description])).toEqual([
      ['play', 'Play a YouTube video audio'],
      ['playnext', 'Queue a YouTube video audio to play next'],
      ['pause', 'Pause the currently playing song'],
      ['unpause', 'Resume song playback'],
      ['skip', 'Skip the currently playing song'],
      ['skipto', 'Skip to a song in the queue'],
      ['stop', 'Stop playback and clear the queue'],
      ['nowplaying', 'Show the currently playing song and its progress'],
      ['queue', 'Show the songs in the queue'],
      ['remove', 'Remove a song from the queue'],
      ['move', 'Move a song to another queue position'],
      ['shuffle', 'Shuffle the queue'],
      ['clear', 'Remove every song from the queue, keeping the current one'],
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

  it.each(['play', 'playnext'] as const)('requires the %s URL option', (command) => {
    expect(optionsOf(command)).toEqual([
      expect.objectContaining({
        description: 'The YouTube video URL',
        name: 'url',
        required: true,
        type: ApplicationCommandOptionType.String,
      }),
    ]);
  });

  it.each([
    ['remove', ['position']],
    ['skipto', ['position']],
    ['move', ['from', 'to']],
  ] as const)('requires %s queue positions within the queue limit', (command, names) => {
    expect(optionsOf(command)).toMatchObject(
      names.map((name) => ({
        max_value: 100,
        min_value: 1,
        name,
        required: true,
        type: ApplicationCommandOptionType.Integer,
      })),
    );
  });

  it('accepts an optional queue page', () => {
    expect(optionsOf('queue')).toEqual([
      expect.objectContaining({
        min_value: 1,
        name: 'page',
        required: false,
        type: ApplicationCommandOptionType.Integer,
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
