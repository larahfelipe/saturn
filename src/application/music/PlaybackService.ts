import { NotInVoiceChannelError, RateLimitedError } from '../errors.ts';
import { RateLimiter } from '../RateLimiter.ts';
import type { GuildPlayer, PlayResult } from './GuildPlayer.ts';
import type { PlayerRegistry } from './PlayerRegistry.ts';

export interface PlayCommand {
  readonly guildId: string;
  readonly url: string;
  readonly requestedBy: string;
  /** The requester's current voice channel, if any. */
  readonly voiceChannelId: string | undefined;
}

/** Default `play` requests allowed per user: a few songs in a row, not a flood of lookups. */
export const PLAY_RATE_LIMIT = { limit: 5, windowMs: 10_000 } as const;

export interface PlaybackServiceOptions {
  /** Limits `play` requests per user; defaults to `PLAY_RATE_LIMIT`. */
  readonly playLimiter?: RateLimiter;
}

/**
 * Playback use cases, addressed by guild. While the bot is in a voice channel,
 * only members in that channel may add songs or control playback. Controls on
 * a guild without a player report `false`.
 */
export class PlaybackService {
  readonly #registry: PlayerRegistry;
  readonly #playLimiter: RateLimiter;

  constructor(registry: PlayerRegistry, options: PlaybackServiceOptions = {}) {
    this.#registry = registry;
    this.#playLimiter = options.playLimiter ?? new RateLimiter(PLAY_RATE_LIMIT);
  }

  /**
   * @throws NotInVoiceChannelError, RateLimitedError, PlayerUnavailableError,
   *   or any error documented by `GuildPlayer.play`, such as NotListeningError.
   */
  async play(command: PlayCommand): Promise<PlayResult> {
    const { guildId, url, requestedBy, voiceChannelId } = command;
    if (voiceChannelId === undefined) throw new NotInVoiceChannelError();
    const limit = this.#playLimiter.tryAcquire(requestedBy);
    if (!limit.allowed) throw new RateLimitedError(limit.retryAfterMs);
    return this.#registry.acquire(guildId).play({ url, requestedBy, voiceChannelId });
  }

  /**
   * Controls take the requester's current voice channel, if any.
   * @throws NotListeningError when the requester is not in the bot's channel.
   */
  pause(guildId: string, voiceChannelId: string | undefined): boolean {
    return this.#control(guildId, voiceChannelId, (player) => player.pause());
  }

  /** @throws NotListeningError, as `pause`. */
  resume(guildId: string, voiceChannelId: string | undefined): boolean {
    return this.#control(guildId, voiceChannelId, (player) => player.resume());
  }

  /** @throws NotListeningError, as `pause`. */
  skip(guildId: string, voiceChannelId: string | undefined): boolean {
    return this.#control(guildId, voiceChannelId, (player) => player.skip());
  }

  /** @throws NotListeningError, as `pause`. */
  stop(guildId: string, voiceChannelId: string | undefined): boolean {
    return this.#control(guildId, voiceChannelId, (player) => player.stop());
  }

  #control(
    guildId: string,
    voiceChannelId: string | undefined,
    apply: (player: GuildPlayer) => boolean,
  ): boolean {
    const player = this.#registry.get(guildId);
    if (player === undefined) return false;
    player.assertListener(voiceChannelId);
    return apply(player);
  }
}
