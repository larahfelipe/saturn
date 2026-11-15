import { NotInVoiceChannelError, RateLimitedError } from '../errors.ts';
import { RateLimiter } from '../RateLimiter.ts';
import type { PlayResult } from './GuildPlayer.ts';
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

/** Playback use cases, addressed by guild. Controls on a guild without a player report `false`. */
export class PlaybackService {
  readonly #registry: PlayerRegistry;
  readonly #playLimiter: RateLimiter;

  constructor(registry: PlayerRegistry, options: PlaybackServiceOptions = {}) {
    this.#registry = registry;
    this.#playLimiter = options.playLimiter ?? new RateLimiter(PLAY_RATE_LIMIT);
  }

  /**
   * @throws NotInVoiceChannelError, RateLimitedError, PlayerUnavailableError,
   *   or any error documented by `GuildPlayer.play`.
   */
  async play(command: PlayCommand): Promise<PlayResult> {
    const { guildId, url, requestedBy, voiceChannelId } = command;
    if (voiceChannelId === undefined) throw new NotInVoiceChannelError();
    const limit = this.#playLimiter.tryAcquire(requestedBy);
    if (!limit.allowed) throw new RateLimitedError(limit.retryAfterMs);
    return this.#registry.acquire(guildId).play({ url, requestedBy, voiceChannelId });
  }

  pause(guildId: string): boolean {
    return this.#registry.get(guildId)?.pause() ?? false;
  }

  resume(guildId: string): boolean {
    return this.#registry.get(guildId)?.resume() ?? false;
  }

  skip(guildId: string): boolean {
    return this.#registry.get(guildId)?.skip() ?? false;
  }

  stop(guildId: string): boolean {
    return this.#registry.get(guildId)?.stop() ?? false;
  }
}
