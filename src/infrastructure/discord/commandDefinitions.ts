import { InteractionContextType, SlashCommandBuilder } from 'discord.js';
import type {
  RESTPostAPIChatInputApplicationCommandsJSONBody,
  SlashCommandIntegerOption,
} from 'discord.js';

import { MAX_QUEUE_LENGTH } from '../../application/music/GuildPlayer.ts';

export type CommandDefinition = RESTPostAPIChatInputApplicationCommandsJSONBody & {
  readonly name: CommandName;
};

export type CommandName =
  | 'clear'
  | 'health'
  | 'help'
  | 'move'
  | 'nowplaying'
  | 'pause'
  | 'ping'
  | 'play'
  | 'playnext'
  | 'queue'
  | 'remove'
  | 'shuffle'
  | 'skip'
  | 'skipto'
  | 'stop'
  | 'unpause';

type Configure = (builder: SlashCommandBuilder) => {
  toJSON(): RESTPostAPIChatInputApplicationCommandsJSONBody;
};

function define(
  name: CommandName,
  description: string,
  configure: Configure = (builder) => builder,
): CommandDefinition {
  const builder = new SlashCommandBuilder()
    .setName(name)
    .setDescription(description)
    .setContexts(InteractionContextType.Guild);
  return { ...configure(builder).toJSON(), name };
}

function positionOption(
  name: string,
  description: string,
): (option: SlashCommandIntegerOption) => SlashCommandIntegerOption {
  return (option) =>
    option
      .setName(name)
      .setDescription(description)
      .setRequired(true)
      .setMinValue(1)
      .setMaxValue(MAX_QUEUE_LENGTH);
}

const urlOption: Configure = (builder) =>
  builder.addStringOption((option) =>
    option.setName('url').setDescription('The YouTube video URL').setRequired(true),
  );

export const COMMAND_DEFINITIONS: readonly CommandDefinition[] = [
  define('play', 'Play a YouTube video audio', urlOption),
  define('playnext', 'Queue a YouTube video audio to play next', urlOption),
  define('pause', 'Pause the currently playing song'),
  define('unpause', 'Resume song playback'),
  define('skip', 'Skip the currently playing song'),
  define('skipto', 'Skip to a song in the queue', (builder) =>
    builder.addIntegerOption(positionOption('position', 'The queue position of the song')),
  ),
  define('stop', 'Stop playback and clear the queue'),
  define('nowplaying', 'Show the currently playing song and its progress'),
  define('queue', 'Show the songs in the queue', (builder) =>
    builder.addIntegerOption((option) =>
      option.setName('page').setDescription('The page of the queue to show').setMinValue(1),
    ),
  ),
  define('remove', 'Remove a song from the queue', (builder) =>
    builder.addIntegerOption(positionOption('position', 'The queue position of the song')),
  ),
  define('move', 'Move a song to another queue position', (builder) =>
    builder
      .addIntegerOption(positionOption('from', 'The queue position of the song'))
      .addIntegerOption(positionOption('to', 'The new queue position of the song')),
  ),
  define('shuffle', 'Shuffle the queue'),
  define('clear', 'Remove every song from the queue, keeping the current one'),
  define('ping', 'Verify bot responsiveness'),
  define('health', 'Check bot heartbeat latency'),
  define('help', 'Show available commands list'),
];
