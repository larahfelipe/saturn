import { MessageFlags } from 'discord.js';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  InvalidTrackUrlError,
  NoAudioFormatError,
  NotInVoiceChannelError,
  PlaybackCancelledError,
  PlayerUnavailableError,
  QueueFullError,
  TrackResolutionError,
  TrackUnavailableError,
  VoiceChannelUnusableError,
  VoiceConnectionError,
} from '../../../src/application/errors.ts';
import { PlaybackService } from '../../../src/application/music/PlaybackService.ts';
import { PlayerRegistry } from '../../../src/application/music/PlayerRegistry.ts';
import { CommandRegistry } from '../../../src/infrastructure/discord/CommandRegistry.ts';
import {
  COMMAND_DEFINITIONS,
  type CommandName,
} from '../../../src/infrastructure/discord/commandDefinitions.ts';
import {
  createCommandHandlers,
  type CommandHandler,
} from '../../../src/infrastructure/discord/commands.ts';
import {
  InteractionHandler,
  userErrorMessage,
} from '../../../src/infrastructure/discord/InteractionHandler.ts';
import { playbackControls } from '../../../src/infrastructure/discord/replies.ts';
import {
  FakeResolver,
  FakeVoiceConnector,
  flush,
  RecordingLogger,
  trackUrl,
} from '../../fixtures/fakes.ts';
import {
  FakeButtonInteraction,
  FakeCommandInteraction,
  FakeOtherInteraction,
  GUILD_ID,
  OTHER_GUILD_ID,
  USER_ID,
  VOICE_CHANNEL_ID,
} from '../../fixtures/interactions.ts';

const BOT = { username: 'Saturn', avatarUrl: undefined };
const EPHEMERAL = MessageFlags.Ephemeral;

function playInteraction(id = 'aaaaaaaaaaa', guildId = GUILD_ID): FakeCommandInteraction {
  return new FakeCommandInteraction('play', { options: { url: trackUrl(id) }, guildId });
}

describe('InteractionHandler', () => {
  let resolver: FakeResolver;
  let voice: FakeVoiceConnector;
  let registry: PlayerRegistry;
  let logger: RecordingLogger;
  let recorded: string[];
  let handlers: Record<CommandName, CommandHandler>;
  let handler: InteractionHandler;

  beforeEach(() => {
    resolver = new FakeResolver();
    voice = new FakeVoiceConnector();
    logger = new RecordingLogger();
    registry = new PlayerRegistry({ resolver, voice, logger });
    const playback = new PlaybackService(registry);
    recorded = [];
    handlers = {
      ...createCommandHandlers({
        playback,
        definitions: COMMAND_DEFINITIONS,
        bot: () => BOT,
        heartbeatLatency: () => 37,
      }),
    };
    handler = new InteractionHandler({
      commands: new CommandRegistry(COMMAND_DEFINITIONS, handlers),
      playback,
      bot: () => BOT,
      metrics: { recordCommand: (name) => recorded.push(name) },
      logger,
    });
  });

  describe('slash commands', () => {
    it('defers play, then edits the reply with the result', async () => {
      const interaction = playInteraction();

      await handler.handle(interaction.asInteraction());

      expect(interaction.responses).toEqual([
        { method: 'deferReply' },
        {
          method: 'editReply',
          options: {
            embeds: [expect.objectContaining({ description: `Requested by <@${USER_ID}> Enjoy!` })],
            components: [playbackControls(GUILD_ID)],
          },
        },
      ]);
      expect(voice.calls[0]?.target).toEqual({ guildId: GUILD_ID, channelId: VOICE_CHANNEL_ID });
      expect(recorded).toEqual(['play']);
    });

    it('defers before resolving the track', async () => {
      resolver.manual = true;
      const interaction = playInteraction();

      const handled = handler.handle(interaction.asInteraction());
      await flush();

      expect(interaction.responses).toEqual([{ method: 'deferReply' }]);
      const call = resolver.calls[0];
      call?.deferred.resolve(call.result);
      await handled;
      expect(interaction.responses.map(({ method }) => method)).toEqual([
        'deferReply',
        'editReply',
      ]);
    });

    it('replies directly to commands that do not defer', async () => {
      const interaction = new FakeCommandInteraction('ping');

      await handler.handle(interaction.asInteraction());

      expect(interaction.responses).toEqual([
        { method: 'reply', options: { content: 'Pong! 🏓' } },
      ]);
      expect(recorded).toEqual(['ping']);
    });

    it('passes the requester and voice channel to the command', async () => {
      const interaction = new FakeCommandInteraction('play', {
        options: { url: trackUrl('aaaaaaaaaaa') },
        voiceChannelId: null,
      });

      await handler.handle(interaction.asInteraction());

      expect(resolver.calls).toHaveLength(0);
      expect(interaction.responses.at(-1)).toEqual({
        method: 'editReply',
        options: {
          embeds: [
            expect.objectContaining({
              description:
                'Something went wrong while trying to join the party. Please, try again later',
            }),
          ],
        },
      });
      const rejected = logger.contextOf('info', 'command rejected');
      expect(rejected).toMatchObject({ command: 'play', guildId: GUILD_ID });
      expect(rejected?.err).toBeInstanceOf(NotInVoiceChannelError);
    });

    it('presents a failure after deferring as the edited reply', async () => {
      resolver.failWith = new TrackUnavailableError('private video');
      const interaction = playInteraction();

      await handler.handle(interaction.asInteraction());

      expect(interaction.responses).toEqual([
        { method: 'deferReply' },
        {
          method: 'editReply',
          options: {
            embeds: [
              expect.objectContaining({
                description:
                  'Something went wrong while searching your song. Please, try again later',
              }),
            ],
          },
        },
      ]);
      expect(logger.at('warn')).toContainEqual(
        expect.objectContaining({ message: 'command failed' }),
      );
    });

    it('logs unexpected errors and replies with a generic message', async () => {
      const boom = new Error('boom');
      handlers.ping = {
        execute: () => {
          throw boom;
        },
      };
      handler = new InteractionHandler({
        commands: new CommandRegistry(COMMAND_DEFINITIONS, handlers),
        playback: new PlaybackService(registry),
        bot: () => BOT,
        metrics: { recordCommand: () => undefined },
        logger,
      });
      const interaction = new FakeCommandInteraction('ping');

      await handler.handle(interaction.asInteraction());

      expect(interaction.responses).toEqual([
        {
          method: 'reply',
          options: {
            embeds: [
              expect.objectContaining({
                description: 'Something went wrong. Please, try again later',
              }),
            ],
          },
        },
      ]);
      expect(logger.at('error')).toHaveLength(1);
      expect(logger.contextOf('error', 'command failed')?.err).toBe(boom);
    });

    it('reports an idle player for controls', async () => {
      const interaction = new FakeCommandInteraction('skip');

      await handler.handle(interaction.asInteraction());

      expect(interaction.responses).toEqual([
        { method: 'reply', options: { content: 'There is no song playing right now' } },
      ]);
    });

    it('rejects unknown commands without counting them', async () => {
      const interaction = new FakeCommandInteraction('volume');

      await handler.handle(interaction.asInteraction());

      expect(interaction.responses).toEqual([
        { method: 'reply', options: { content: 'Unknown command', flags: EPHEMERAL } },
      ]);
      expect(recorded).toEqual([]);
      expect(logger.contextOf('warn', 'unknown command')).toMatchObject({ command: 'volume' });
    });

    it('rejects commands outside a cached guild without running them', async () => {
      const interaction = new FakeCommandInteraction('play', {
        options: { url: trackUrl('aaaaaaaaaaa') },
        guildId: null,
        cached: false,
      });

      await handler.handle(interaction.asInteraction());

      expect(interaction.responses).toEqual([
        {
          method: 'reply',
          options: { content: 'This command can only be used in a server', flags: EPHEMERAL },
        },
      ]);
      expect(resolver.calls).toHaveLength(0);
      expect(recorded).toEqual([]);
    });

    it('logs failed responses instead of rejecting', async () => {
      const interaction = new FakeCommandInteraction('ping');
      interaction.failResponsesWith = new Error('Unknown interaction');

      await expect(handler.handle(interaction.asInteraction())).resolves.toBeUndefined();

      expect(logger.at('error')).toHaveLength(1);
      expect(logger.contextOf('error', 'failed to respond to interaction')).toMatchObject({
        command: 'ping',
        err: interaction.failResponsesWith,
      });
    });

    it('does not resolve the track when the interaction cannot be deferred', async () => {
      const interaction = playInteraction();
      interaction.failResponsesWith = new Error('Unknown interaction');

      await expect(handler.handle(interaction.asInteraction())).resolves.toBeUndefined();

      expect(resolver.calls).toHaveLength(0);
      expect(logger.at('error').map(({ message }) => message)).toEqual([
        'command failed',
        'failed to respond to interaction',
      ]);
    });
  });

  describe('playback buttons', () => {
    beforeEach(async () => {
      await handler.handle(playInteraction('aaaaaaaaaaa').asInteraction());
      await handler.handle(playInteraction('bbbbbbbbbbb').asInteraction());
      await handler.handle(playInteraction('ccccccccccc', OTHER_GUILD_ID).asInteraction());
      await flush();
      recorded = [];
    });

    it.each([
      ['pause', 'Playback paused ⏸️'],
      ['unpause', 'Playback resumed ▶️'],
      ['skip', 'Song skipped ⏭️'],
      ['stop', 'Playback stopped 🛑'],
    ])('runs %s on the guild player with an ephemeral reply', async (control, message) => {
      if (control === 'unpause') registry.get(GUILD_ID)?.pause();
      const interaction = new FakeButtonInteraction(`${control}_${GUILD_ID}`);

      await handler.handle(interaction.asInteraction());

      expect(interaction.responses).toEqual([
        { method: 'reply', options: { content: message, flags: EPHEMERAL } },
      ]);
      expect(registry.get(OTHER_GUILD_ID)?.state).toMatchObject({
        status: 'playing',
        current: { id: 'ccccccccccc' },
      });
      expect(recorded).toEqual([]);
    });

    it('applies the control to the guild player', async () => {
      await handler.handle(new FakeButtonInteraction(`pause_${GUILD_ID}`).asInteraction());
      expect(registry.get(GUILD_ID)?.state.status).toBe('paused');

      await handler.handle(new FakeButtonInteraction(`skip_${GUILD_ID}`).asInteraction());
      await flush();
      expect(registry.get(GUILD_ID)?.state).toMatchObject({ current: { id: 'bbbbbbbbbbb' } });

      await handler.handle(new FakeButtonInteraction(`stop_${GUILD_ID}`).asInteraction());
      expect(registry.get(GUILD_ID)).toBeUndefined();
      expect(registry.get(OTHER_GUILD_ID)).toBeDefined();
    });

    it('reports controls on a guild without a player', async () => {
      const idleGuildId = '111111111111111111';
      const interaction = new FakeButtonInteraction(`skip_${idleGuildId}`, idleGuildId);

      await handler.handle(interaction.asInteraction());

      expect(interaction.responses).toEqual([
        {
          method: 'reply',
          options: {
            content: 'Command could not be completed (player might be idle)',
            flags: EPHEMERAL,
          },
        },
      ]);
    });

    it.each([
      ['targets another guild', `stop_${OTHER_GUILD_ID}`],
      ['is malformed', 'stop'],
      ['names an unsupported control', `volume_${GUILD_ID}`],
    ])('rejects an ID that %s but still acknowledges it', async (_, customId) => {
      const interaction = new FakeButtonInteraction(customId);

      await handler.handle(interaction.asInteraction());

      expect(interaction.responses).toEqual([
        {
          method: 'reply',
          options: {
            content: 'Command could not be completed (player might be idle)',
            flags: EPHEMERAL,
          },
        },
      ]);
      expect(registry.get(GUILD_ID)?.state.status).toBe('playing');
      expect(registry.get(OTHER_GUILD_ID)?.state.status).toBe('playing');
      expect(logger.contextOf('warn', 'rejected playback control')).toMatchObject({
        customId,
        guildId: GUILD_ID,
      });
    });

    it('rejects controls from outside a guild', async () => {
      const interaction = new FakeButtonInteraction(`stop_${GUILD_ID}`, null);

      await handler.handle(interaction.asInteraction());

      expect(interaction.responses).toHaveLength(1);
      expect(registry.get(GUILD_ID)?.state.status).toBe('playing');
    });
  });

  it('ignores interactions it does not route', async () => {
    const interaction = new FakeOtherInteraction();

    await handler.handle(interaction.asInteraction());

    expect(interaction.responses).toEqual([]);
    expect(logger.entries).toEqual([]);
  });
});

describe('userErrorMessage', () => {
  it.each([
    [new InvalidTrackUrlError(), 'Invalid YouTube URL. Please provide a valid YouTube link'],
    [new NoAudioFormatError(), 'No suitable audio track was found for this video'],
    [
      new TrackUnavailableError('private'),
      'Something went wrong while searching your song. Please, try again later',
    ],
    [
      new TrackResolutionError('timeout'),
      'Something went wrong while searching your song. Please, try again later',
    ],
    [
      new NotInVoiceChannelError(),
      'Something went wrong while trying to join the party. Please, try again later',
    ],
    [
      new VoiceConnectionError('lost'),
      'Something went wrong while trying to join the party. Please, try again later',
    ],
    [
      new VoiceChannelUnusableError('stage'),
      'I cannot play in stage channels. Please, join a voice channel',
    ],
    [
      new VoiceChannelUnusableError('afk'),
      'I cannot play in the AFK channel. Please, join another voice channel',
    ],
    [new VoiceChannelUnusableError('full'), 'Your voice channel is full'],
    [
      new VoiceChannelUnusableError('missing-permissions'),
      'I need permission to connect and speak in your voice channel',
    ],
    [new QueueFullError(100), 'The queue is full (100 songs). Please, try again later'],
    [new PlaybackCancelledError(), 'Playback was stopped before your song could be added'],
    [new PlayerUnavailableError(), 'Saturn is shutting down. Please, try again later'],
    [new Error('boom'), undefined],
    ['not an error', undefined],
  ])('maps %o', (error, message) => {
    expect(userErrorMessage(error)).toBe(message);
  });
});
