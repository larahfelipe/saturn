import type { PlaybackService } from '../../application/music/PlaybackService.ts';
import type { CommandDefinition, CommandName } from './commandDefinitions.ts';
import {
  CONTROL_MESSAGES,
  EMPTY_QUEUE_MESSAGE,
  errorEmbed,
  IDLE_MESSAGE,
  nowPlayingEmbed,
  nowPlayingProgressEmbed,
  playbackControls,
  QUEUE_CLEARED_MESSAGE,
  QUEUE_SHUFFLED_MESSAGE,
  queuedEmbed,
  queueEmbed,
  standardEmbed,
  trackLink,
} from './replies.ts';
import type { BotProfile, PlaybackControl, Reply } from './replies.ts';

export interface CommandContext {
  readonly guildId: string;
  readonly integerOption: (name: string) => number | undefined;
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

  const missingOption = (name: string): Reply => ({
    embeds: [errorEmbed(bot(), `Missing ${name} option`)],
  });

  const queueChanged = (description: string): Reply => ({
    embeds: [standardEmbed(bot(), description)],
  });

  const play = (next: boolean): CommandHandler => ({
    defer: true,
    async execute({ guildId, option, userId, voiceChannelId }) {
      const url = option('url');
      if (url === undefined) return missingOption('song url');

      const result = await playback.play({
        guildId,
        next,
        requestedBy: userId,
        url,
        voiceChannelId,
      });
      const embed =
        result.status === 'playing'
          ? nowPlayingEmbed(result.track)
          : queuedEmbed(result.track, result.position);
      return { components: [playbackControls(guildId)], embeds: [embed] };
    },
  });

  return {
    clear: {
      execute: ({ guildId, voiceChannelId }) => ({
        content:
          playback.clear(guildId, voiceChannelId) > 0 ? QUEUE_CLEARED_MESSAGE : EMPTY_QUEUE_MESSAGE,
      }),
    },
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
    move: {
      execute: ({ guildId, integerOption, voiceChannelId }) => {
        const from = integerOption('from');
        const to = integerOption('to');
        if (from === undefined || to === undefined) return missingOption('position');
        const track = playback.move(guildId, voiceChannelId, from, to);
        return queueChanged(`Moved ${trackLink(track)} to position ${to}`);
      },
    },
    nowplaying: {
      execute: ({ guildId }) => {
        const current = playback.nowPlaying(guildId);
        if (current === undefined) return { content: IDLE_MESSAGE };
        return {
          components: [playbackControls(guildId)],
          embeds: [nowPlayingProgressEmbed(current)],
        };
      },
    },
    pause: control('pause'),
    ping: { execute: () => ({ content: 'Pong! 🏓' }) },
    play: play(false),
    playnext: play(true),
    queue: {
      execute: ({ guildId, integerOption }) => {
        const current = playback.nowPlaying(guildId);
        if (current === undefined) return { content: EMPTY_QUEUE_MESSAGE };
        const page = integerOption('page') ?? 1;
        return { embeds: [queueEmbed(bot(), current, playback.upcoming(guildId), page)] };
      },
    },
    remove: {
      execute: ({ guildId, integerOption, voiceChannelId }) => {
        const position = integerOption('position');
        if (position === undefined) return missingOption('position');
        const track = playback.remove(guildId, voiceChannelId, position);
        return queueChanged(`Removed ${trackLink(track)} from the queue`);
      },
    },
    shuffle: {
      execute: ({ guildId, voiceChannelId }) => ({
        content:
          playback.shuffle(guildId, voiceChannelId) > 0
            ? QUEUE_SHUFFLED_MESSAGE
            : EMPTY_QUEUE_MESSAGE,
      }),
    },
    skip: control('skip'),
    skipto: {
      execute: ({ guildId, integerOption, voiceChannelId }) => {
        const position = integerOption('position');
        if (position === undefined) return missingOption('position');
        const track = playback.skipTo(guildId, voiceChannelId, position);
        return queueChanged(`Skipped to ${trackLink(track)} ⏭️`);
      },
    },
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
