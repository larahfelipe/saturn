import type { Track } from '../../domain/music/Track.ts';
import { NotInVoiceChannelError, QueuePositionError, RateLimitedError } from '../errors.ts';
import { RateLimiter } from '../RateLimiter.ts';
import type { GuildPlayer, NowPlaying, PlayResult } from './GuildPlayer.ts';
import type { PlayerRegistry } from './PlayerRegistry.ts';

export interface ListenerUpdate {
  readonly channelId: string;
  readonly guildId: string;
  readonly listeners: number;
}

export interface PlayCommand {
  readonly guildId: string;
  readonly next?: boolean;
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

  clear(guildId: string, voiceChannelId: string | undefined): number {
    return this.#control(guildId, voiceChannelId, (player) => player.clear()) ?? 0;
  }

  move(guildId: string, voiceChannelId: string | undefined, from: number, to: number): Track {
    return (
      this.#control(guildId, voiceChannelId, (player) => player.move(from, to)) ?? emptyQueue()
    );
  }

  nowPlaying(guildId: string): NowPlaying | undefined {
    return this.#registry.get(guildId)?.nowPlaying;
  }

  pause(guildId: string, voiceChannelId: string | undefined): boolean {
    return this.#control(guildId, voiceChannelId, (player) => player.pause()) ?? false;
  }

  async play(command: PlayCommand): Promise<PlayResult> {
    const { guildId, next = false, requestedBy, url, voiceChannelId } = command;
    if (voiceChannelId === undefined) throw new NotInVoiceChannelError();
    const limit = this.#playLimiter.tryAcquire(requestedBy);
    if (!limit.allowed) throw new RateLimitedError(limit.retryAfterMs);
    return this.#registry.acquire(guildId).play({ next, requestedBy, url, voiceChannelId });
  }

  remove(guildId: string, voiceChannelId: string | undefined, position: number): Track {
    return (
      this.#control(guildId, voiceChannelId, (player) => player.remove(position)) ?? emptyQueue()
    );
  }

  resume(guildId: string, voiceChannelId: string | undefined): boolean {
    return this.#control(guildId, voiceChannelId, (player) => player.resume()) ?? false;
  }

  shuffle(guildId: string, voiceChannelId: string | undefined): number {
    return this.#control(guildId, voiceChannelId, (player) => player.shuffle()) ?? 0;
  }

  skip(guildId: string, voiceChannelId: string | undefined): boolean {
    return this.#control(guildId, voiceChannelId, (player) => player.skip()) ?? false;
  }

  skipTo(guildId: string, voiceChannelId: string | undefined, position: number): Track {
    return (
      this.#control(guildId, voiceChannelId, (player) => player.skipTo(position)) ?? emptyQueue()
    );
  }

  stop(guildId: string, voiceChannelId: string | undefined): boolean {
    return this.#control(guildId, voiceChannelId, (player) => player.stop()) ?? false;
  }

  upcoming(guildId: string): readonly Track[] {
    return this.#registry.get(guildId)?.upcoming ?? [];
  }

  updateListeners(update: ListenerUpdate): void {
    this.#registry.get(update.guildId)?.updateListeners(update.channelId, update.listeners);
  }

  #control<T>(
    guildId: string,
    voiceChannelId: string | undefined,
    apply: (player: GuildPlayer) => T,
  ): T | undefined {
    const player = this.#registry.get(guildId);
    if (player === undefined) return undefined;
    player.assertListener(voiceChannelId);
    return apply(player);
  }
}

function emptyQueue(): never {
  throw new QueuePositionError(0);
}
