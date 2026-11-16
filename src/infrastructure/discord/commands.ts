import type { PlaybackService } from '../../application/music/PlaybackService.ts';
import type { CommandDefinition, CommandName } from './commandDefinitions.ts';
import {
  CONTROL_MESSAGES,
  errorEmbed,
  IDLE_MESSAGE,
  nowPlayingEmbed,
  playbackControls,
  queuedEmbed,
  standardEmbed,
  type BotProfile,
  type PlaybackControl,
  type Reply,
} from './replies.ts';

/** What a command needs from the interaction that invoked it. */
export interface CommandContext {
  readonly guildId: string;
  readonly userId: string;
  readonly voiceChannelId: string | undefined;
  readonly option: (name: string) => string | undefined;
}

export interface CommandHandler {
  /**
   * Acknowledge before executing, for commands that may exceed Discord's 3 s
   * reply window. Deferred commands of a guild are executed in arrival order,
   * each once the previous `execute` call has returned.
   */
  readonly defer?: boolean;
  /** Errors thrown are presented to the user by the interaction handler. */
  execute(context: CommandContext): Promise<Reply> | Reply;
}

export interface CommandDependencies {
  readonly playback: PlaybackService;
  readonly definitions: readonly CommandDefinition[];
  readonly bot: () => BotProfile;
  readonly heartbeatLatency: () => number;
}

/**
 * Runs a playback control for `guildId` on behalf of a member in
 * `voiceChannelId`; `false` when the guild has no matching playback.
 * @throws NotListeningError when the member is not in the bot's voice channel.
 */
export function runControl(
  playback: PlaybackService,
  control: PlaybackControl,
  guildId: string,
  voiceChannelId: string | undefined,
): boolean {
  switch (control) {
    case 'pause':
      return playback.pause(guildId, voiceChannelId);
    case 'unpause':
      return playback.resume(guildId, voiceChannelId);
    case 'skip':
      return playback.skip(guildId, voiceChannelId);
    case 'stop':
      return playback.stop(guildId, voiceChannelId);
  }
}

export function createCommandHandlers(
  dependencies: CommandDependencies,
): Readonly<Record<CommandName, CommandHandler>> {
  const { playback, definitions, bot, heartbeatLatency } = dependencies;

  const control = (name: PlaybackControl): CommandHandler => ({
    execute: ({ guildId, voiceChannelId }) => ({
      content: runControl(playback, name, guildId, voiceChannelId)
        ? CONTROL_MESSAGES[name]
        : IDLE_MESSAGE,
    }),
  });

  return {
    play: {
      defer: true,
      async execute({ guildId, userId, voiceChannelId, option }) {
        const url = option('url');
        if (url === undefined) return { embeds: [errorEmbed(bot(), 'Missing song url option')] };

        const result = await playback.play({ guildId, url, requestedBy: userId, voiceChannelId });
        const embed =
          result.status === 'playing'
            ? nowPlayingEmbed(result.track)
            : queuedEmbed(result.track, result.position);
        return { embeds: [embed], components: [playbackControls(guildId)] };
      },
    },
    pause: control('pause'),
    unpause: control('unpause'),
    skip: control('skip'),
    stop: control('stop'),
    ping: { execute: () => ({ content: 'Pong! 🏓' }) },
    health: {
      execute: () => ({
        embeds: [standardEmbed(bot(), `Heartbeat latency: ${heartbeatLatency()}ms`)],
      }),
    },
    help: {
      execute: () => {
        const lines = definitions.map(({ name, description }) => `\`/${name}\` - ${description}`);
        return {
          embeds: [standardEmbed(bot(), ['Available slash commands:', ...lines].join('\n'))],
        };
      },
    },
  };
}
