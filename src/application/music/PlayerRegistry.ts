import { PlayerUnavailableError } from '../errors.ts';
import type { Logger } from '../ports/Logger.ts';
import type { TrackResolver } from '../ports/TrackResolver.ts';
import type { VoiceConnector } from '../ports/Voice.ts';
import { GuildPlayer, MAX_QUEUE_LENGTH } from './GuildPlayer.ts';

export interface PlayerRegistryOptions {
  readonly logger: Logger;
  readonly maxQueueLength?: number;
  readonly resolver: TrackResolver;
  readonly voice: VoiceConnector;
}

export class PlayerRegistry {
  get isClosed(): boolean {
    return this.#closed;
  }
  get size(): number {
    return this.#players.size;
  }

  #closed = false;
  readonly #options: PlayerRegistryOptions;
  readonly #players = new Map<string, GuildPlayer>();

  constructor(options: PlayerRegistryOptions) {
    this.#options = options;
  }

  acquire(guildId: string): GuildPlayer {
    if (this.#closed) throw new PlayerUnavailableError();
    const existing = this.#players.get(guildId);
    if (existing !== undefined) return existing;

    const player: GuildPlayer = new GuildPlayer({
      guildId,
      logger: this.#options.logger.child({ guildId }),
      maxQueueLength: this.#options.maxQueueLength ?? MAX_QUEUE_LENGTH,
      onIdle: () => {
        this.#release(guildId, player);
      },
      resolver: this.#options.resolver,
      voice: this.#options.voice,
    });
    this.#players.set(guildId, player);
    return player;
  }

  activeCount(): number {
    let count = 0;
    for (const player of this.#players.values()) if (player.isActive) count++;
    return count;
  }

  close(): void {
    this.#closed = true;
    const players = this.#players.values().toArray();
    this.#players.clear();
    for (const player of players) player.dispose();
  }

  get(guildId: string): GuildPlayer | undefined {
    return this.#players.get(guildId);
  }

  #release(guildId: string, player: GuildPlayer): void {
    if (this.#players.get(guildId) !== player) return;
    this.#players.delete(guildId);
    player.dispose();
  }
}
