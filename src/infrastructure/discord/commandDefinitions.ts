import {
  InteractionContextType,
  SlashCommandBuilder,
  type RESTPostAPIChatInputApplicationCommandsJSONBody,
} from 'discord.js';

export type CommandName =
  'play' | 'pause' | 'unpause' | 'skip' | 'stop' | 'ping' | 'health' | 'help';

export type CommandDefinition = RESTPostAPIChatInputApplicationCommandsJSONBody & {
  readonly name: CommandName;
};

type Configure = (builder: SlashCommandBuilder) => {
  toJSON(): RESTPostAPIChatInputApplicationCommandsJSONBody;
};

/** A guild-only chat input command. */
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

/** Slash command definitions, in registration and help order. */
export const COMMAND_DEFINITIONS: readonly CommandDefinition[] = [
  define('play', 'Play a YouTube video audio', (builder) =>
    builder.addStringOption((option) =>
      option.setName('url').setDescription('The YouTube video URL').setRequired(true),
    ),
  ),
  define('pause', 'Pause the currently playing song'),
  define('unpause', 'Resume song playback'),
  define('skip', 'Skip the currently playing song'),
  define('stop', 'Stop playback and clear the queue'),
  define('ping', 'Verify bot responsiveness'),
  define('health', 'Check bot heartbeat latency'),
  define('help', 'Show available commands list'),
];
