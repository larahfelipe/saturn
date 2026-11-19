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
} from './replies.ts';
import type { BotProfile, PlaybackControl, Reply } from './replies.ts';

export interface CommandContext {
  readonly guildId: string;
  readonly option: (name: string) => string | undefined;
  readonly userId: string;
  readonly voiceChannelId: string | undefined;
}

export interface CommandDependencies {
  readonly bot: () => BotProfile;
  readonly definitions: readonly CommandDefinition[];
  readonly heartbeatLatency: () => number;
  readonly playback: PlaybackService;
}

export interface CommandHandler {
  readonly defer?: boolean;
  execute(context: CommandContext): Promise<Reply> | Reply;
}

export function createCommandHandlers(
  dependencies: CommandDependencies,
): Readonly<Record<CommandName, CommandHandler>> {
  const { bot, definitions, heartbeatLatency, playback } = dependencies;

  const control = (name: PlaybackControl): CommandHandler => ({
    execute: ({ guildId, voiceChannelId }) => ({
      content: runControl(playback, name, guildId, voiceChannelId)
        ? CONTROL_MESSAGES[name]
        : IDLE_MESSAGE,
    }),
  });

  return {
    health: {
      execute: () => ({
        embeds: [standardEmbed(bot(), `Heartbeat latency: ${heartbeatLatency()}ms`)],
      }),
    },
    help: {
      execute: () => {
        const lines = definitions.map(({ description, name }) => `\`/${name}\` - ${description}`);
        return {
          embeds: [standardEmbed(bot(), ['Available slash commands:', ...lines].join('\n'))],
        };
      },
    },
    pause: control('pause'),
    ping: { execute: () => ({ content: 'Pong! 🏓' }) },
    play: {
      defer: true,
      async execute({ guildId, option, userId, voiceChannelId }) {
        const url = option('url');
        if (url === undefined) return { embeds: [errorEmbed(bot(), 'Missing song url option')] };

        const result = await playback.play({ guildId, requestedBy: userId, url, voiceChannelId });
        const embed =
          result.status === 'playing'
            ? nowPlayingEmbed(result.track)
            : queuedEmbed(result.track, result.position);
        return { components: [playbackControls(guildId)], embeds: [embed] };
      },
    },
    skip: control('skip'),
    stop: control('stop'),
    unpause: control('unpause'),
  };
}

export function runControl(
  playback: PlaybackService,
  control: PlaybackControl,
  guildId: string,
  voiceChannelId: string | undefined,
): boolean {
  switch (control) {
    case 'pause': {
      return playback.pause(guildId, voiceChannelId);
    }
    case 'skip': {
      return playback.skip(guildId, voiceChannelId);
    }
    case 'stop': {
      return playback.stop(guildId, voiceChannelId);
    }
    case 'unpause': {
      return playback.resume(guildId, voiceChannelId);
    }
  }
}
