import { NotInVoiceChannelError, RateLimitedError } from '../errors.ts';
import { RateLimiter } from '../RateLimiter.ts';
import type { GuildPlayer, PlayResult } from './GuildPlayer.ts';
import type { PlayerRegistry } from './PlayerRegistry.ts';

export interface PlayCommand {
  readonly guildId: string;
  readonly requestedBy: string;
  readonly url: string;
  readonly voiceChannelId: string | undefined;
}

export const PLAY_RATE_LIMIT = { limit: 5, windowMs: 10_000 } as const;

export interface PlaybackServiceOptions {
  readonly playLimiter?: RateLimiter;
}

export class PlaybackService {
  readonly #playLimiter: RateLimiter;
  readonly #registry: PlayerRegistry;

  constructor(registry: PlayerRegistry, options: PlaybackServiceOptions = {}) {
    this.#registry = registry;
    this.#playLimiter = options.playLimiter ?? new RateLimiter(PLAY_RATE_LIMIT);
  }

  pause(guildId: string, voiceChannelId: string | undefined): boolean {
    return this.#control(guildId, voiceChannelId, (player) => player.pause());
  }

  async play(command: PlayCommand): Promise<PlayResult> {
    const { guildId, requestedBy, url, voiceChannelId } = command;
    if (voiceChannelId === undefined) throw new NotInVoiceChannelError();
    const limit = this.#playLimiter.tryAcquire(requestedBy);
    if (!limit.allowed) throw new RateLimitedError(limit.retryAfterMs);
    return this.#registry.acquire(guildId).play({ requestedBy, url, voiceChannelId });
  }

  resume(guildId: string, voiceChannelId: string | undefined): boolean {
    return this.#control(guildId, voiceChannelId, (player) => player.resume());
  }

  skip(guildId: string, voiceChannelId: string | undefined): boolean {
    return this.#control(guildId, voiceChannelId, (player) => player.skip());
  }

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
