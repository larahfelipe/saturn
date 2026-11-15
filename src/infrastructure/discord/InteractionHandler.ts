import {
  MessageFlags,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type Interaction,
} from 'discord.js';

import {
  ExternalServiceError,
  InvalidTrackUrlError,
  NoAudioFormatError,
  NotInVoiceChannelError,
  PlaybackCancelledError,
  PlayerUnavailableError,
  QueueFullError,
  RateLimitedError,
  TrackResolutionError,
  TrackUnavailableError,
  UserInputError,
  VoiceChannelUnusableError,
  VoiceConnectionError,
  type VoiceChannelProblem,
} from '../../application/errors.ts';
import type { PlaybackService } from '../../application/music/PlaybackService.ts';
import type { Logger } from '../../application/ports/Logger.ts';
import type { CommandRegistry } from './CommandRegistry.ts';
import { runControl } from './commands.ts';
import {
  CONTROL_FAILED_MESSAGE,
  CONTROL_MESSAGES,
  errorEmbed,
  parseControlId,
  type BotProfile,
  type Reply,
} from './replies.ts';

export interface CommandMetrics {
  /** Called once per recognized command, before it runs. */
  recordCommand(name: string): void;
}

export interface InteractionHandlerOptions {
  readonly commands: CommandRegistry;
  readonly playback: PlaybackService;
  readonly bot: () => BotProfile;
  readonly metrics: CommandMetrics;
  readonly logger: Logger;
}

const UNEXPECTED_ERROR_MESSAGE = 'Something went wrong. Please, try again later';

const VOICE_CHANNEL_MESSAGES: Readonly<Record<VoiceChannelProblem, string>> = {
  stage: 'I cannot play in stage channels. Please, join a voice channel',
  afk: 'I cannot play in the AFK channel. Please, join another voice channel',
  full: 'Your voice channel is full',
  'missing-permissions': 'I need permission to connect and speak in your voice channel',
};

/** Maps errors users can act on, or that are expected from external services, to reply texts. */
export function userErrorMessage(error: unknown): string | undefined {
  if (error instanceof InvalidTrackUrlError) {
    return 'Invalid YouTube URL. Please provide a valid YouTube link';
  }
  if (error instanceof NoAudioFormatError) {
    return 'No suitable audio track was found for this video';
  }
  if (error instanceof TrackUnavailableError || error instanceof TrackResolutionError) {
    return 'Something went wrong while searching your song. Please, try again later';
  }
  if (error instanceof VoiceChannelUnusableError) return VOICE_CHANNEL_MESSAGES[error.problem];
  if (error instanceof NotInVoiceChannelError || error instanceof VoiceConnectionError) {
    return 'Something went wrong while trying to join the party. Please, try again later';
  }
  if (error instanceof RateLimitedError) {
    const seconds = Math.ceil(error.retryAfterMs / 1000);
    return `You are adding songs too quickly. Please, try again in ${seconds} ${seconds === 1 ? 'second' : 'seconds'}`;
  }
  if (error instanceof QueueFullError) {
    return `The queue is full (${error.limit} songs). Please, try again later`;
  }
  if (error instanceof PlaybackCancelledError) {
    return 'Playback was stopped before your song could be added';
  }
  if (error instanceof PlayerUnavailableError) {
    return 'Saturn is shutting down. Please, try again later';
  }
  return undefined;
}

/**
 * Routes slash commands and playback buttons. Every interaction it accepts is
 * acknowledged exactly once, and `handle` never rejects.
 */
export class InteractionHandler {
  readonly #commands: CommandRegistry;
  readonly #playback: PlaybackService;
  readonly #bot: () => BotProfile;
  readonly #metrics: CommandMetrics;
  readonly #logger: Logger;
  /** Per guild, settles once the latest deferred command has been executed. */
  readonly #turns = new Map<string, Promise<undefined>>();

  constructor(options: InteractionHandlerOptions) {
    this.#commands = options.commands;
    this.#playback = options.playback;
    this.#bot = options.bot;
    this.#metrics = options.metrics;
    this.#logger = options.logger;
  }

  async handle(interaction: Interaction): Promise<void> {
    try {
      if (interaction.isChatInputCommand()) await this.#handleCommand(interaction);
      else if (interaction.isButton()) await this.#handleButton(interaction);
    } catch (error) {
      this.#logger.error({ err: error, interactionId: interaction.id }, 'interaction failed');
    }
  }

  async #handleCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    const logger = this.#logger.child({
      command: interaction.commandName,
      guildId: interaction.guildId,
      interactionId: interaction.id,
    });
    const command = this.#commands.get(interaction.commandName);
    if (command === undefined) {
      logger.warn({}, 'unknown command');
      await this.#respond(interaction, { content: 'Unknown command', ephemeral: true }, logger);
      return;
    }
    if (!interaction.inCachedGuild()) {
      const reply = { content: 'This command can only be used in a server', ephemeral: true };
      await this.#respond(interaction, reply, logger);
      return;
    }

    this.#metrics.recordCommand(command.definition.name);
    const execute = (): Promise<Reply> | Reply =>
      command.execute({
        guildId: interaction.guildId,
        userId: interaction.user.id,
        voiceChannelId: interaction.member.voice.channelId ?? undefined,
        option: (name) => interaction.options.getString(name) ?? undefined,
      });
    let reply: Reply;
    try {
      reply = await (command.defer === true
        ? this.#executeInTurn(interaction.guildId, interaction.deferReply(), execute)
        : execute());
    } catch (error) {
      reply = this.#errorReply(error, logger);
    }
    await this.#respond(interaction, reply, logger);
  }

  async #handleButton(interaction: ButtonInteraction): Promise<void> {
    const logger = this.#logger.child({
      guildId: interaction.guildId,
      interactionId: interaction.id,
    });
    const target = parseControlId(interaction.customId);
    let content = CONTROL_FAILED_MESSAGE;
    if (target?.guildId !== interaction.guildId) {
      logger.warn({ customId: interaction.customId }, 'rejected playback control');
    } else if (runControl(this.#playback, target.control, target.guildId)) {
      content = CONTROL_MESSAGES[target.control];
    }
    await this.#respond(interaction, { content, ephemeral: true }, logger);
  }

  /**
   * Executes once `acknowledgement` succeeded and the previous deferred command
   * of the guild has been executed, so commands reach the player in arrival
   * order however long Discord takes to acknowledge each one.
   */
  async #executeInTurn(
    guildId: string,
    acknowledgement: Promise<unknown>,
    execute: () => Promise<Reply> | Reply,
  ): Promise<Reply> {
    // Awaited once this command's turn comes; a rejection must not go unhandled until then.
    acknowledgement.catch(() => undefined);
    const previous = this.#turns.get(guildId);
    const { promise: turn, resolve: release } = Promise.withResolvers<undefined>();
    this.#turns.set(guildId, turn);
    try {
      await previous;
      await acknowledgement;
      const reply = execute();
      release(undefined);
      return await reply;
    } finally {
      release(undefined);
      if (this.#turns.get(guildId) === turn) this.#turns.delete(guildId);
    }
  }

  #errorReply(error: unknown, logger: Logger): Reply {
    const message = userErrorMessage(error);
    if (message === undefined) logger.error({ err: error }, 'command failed');
    else if (error instanceof UserInputError) logger.info({ err: error }, 'command rejected');
    else if (error instanceof ExternalServiceError) logger.warn({ err: error }, 'command failed');
    else logger.info({ err: error }, 'command cancelled');
    return { embeds: [errorEmbed(this.#bot(), message ?? UNEXPECTED_ERROR_MESSAGE)] };
  }

  async #respond(
    interaction: ChatInputCommandInteraction | ButtonInteraction,
    reply: Reply,
    logger: Logger,
  ): Promise<void> {
    const { ephemeral = false, ...message } = reply;
    const flags = ephemeral ? { flags: MessageFlags.Ephemeral as const } : {};
    try {
      if (interaction.deferred) await interaction.editReply(message);
      else await interaction.reply({ ...message, ...flags });
    } catch (error) {
      logger.error({ err: error }, 'failed to respond to interaction');
    }
  }
}
