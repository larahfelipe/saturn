import { PlayerUnavailableError } from '../errors.ts';
import type { Logger } from '../ports/Logger.ts';
import type { TrackResolver } from '../ports/TrackResolver.ts';
import type { VoiceConnector } from '../ports/Voice.ts';
import { GuildPlayer, MAX_QUEUE_LENGTH } from './GuildPlayer.ts';

export interface PlayerRegistryOptions {
  readonly resolver: TrackResolver;
  readonly voice: VoiceConnector;
  readonly logger: Logger;
  readonly maxQueueLength?: number;
}

/**
 * Owns one `GuildPlayer` per guild. Players are created on demand and
 * disposed as soon as they become idle, so no idle player keeps state or
 * resources alive.
 */
export class PlayerRegistry {
  readonly #options: PlayerRegistryOptions;
  readonly #players = new Map<string, GuildPlayer>();
  #closed = false;

  constructor(options: PlayerRegistryOptions) {
    this.#options = options;
  }

  get size(): number {
    return this.#players.size;
  }

  get isClosed(): boolean {
    return this.#closed;
  }

  /** Number of players holding playback resources. */
  activeCount(): number {
    let count = 0;
    for (const player of this.#players.values()) if (player.isActive) count++;
    return count;
  }

  get(guildId: string): GuildPlayer | undefined {
    return this.#players.get(guildId);
  }

  /** @throws PlayerUnavailableError once the registry is closed. */
  acquire(guildId: string): GuildPlayer {
    if (this.#closed) throw new PlayerUnavailableError();
    const existing = this.#players.get(guildId);
    if (existing !== undefined) return existing;

    const player: GuildPlayer = new GuildPlayer({
      guildId,
      resolver: this.#options.resolver,
      voice: this.#options.voice,
      logger: this.#options.logger.child({ guildId }),
      maxQueueLength: this.#options.maxQueueLength ?? MAX_QUEUE_LENGTH,
      onIdle: () => {
        this.#release(guildId, player);
      },
    });
    this.#players.set(guildId, player);
    return player;
  }

  /** Rejects new players and disposes every existing one. Idempotent. */
  close(): void {
    this.#closed = true;
    const players = [...this.#players.values()];
    this.#players.clear();
    for (const player of players) player.dispose();
  }

  #release(guildId: string, player: GuildPlayer): void {
    if (this.#players.get(guildId) !== player) return;
    this.#players.delete(guildId);
    player.dispose();
  }
}
