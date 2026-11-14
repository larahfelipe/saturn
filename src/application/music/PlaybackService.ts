import { NotInVoiceChannelError } from '../errors.ts';
import type { PlayResult } from './GuildPlayer.ts';
import type { PlayerRegistry } from './PlayerRegistry.ts';

export interface PlayCommand {
  readonly guildId: string;
  readonly url: string;
  readonly requestedBy: string;
  /** The requester's current voice channel, if any. */
  readonly voiceChannelId: string | undefined;
}

/** Playback use cases, addressed by guild. Controls on a guild without a player report `false`. */
export class PlaybackService {
  readonly #registry: PlayerRegistry;

  constructor(registry: PlayerRegistry) {
    this.#registry = registry;
  }

  /**
   * @throws NotInVoiceChannelError, PlayerUnavailableError, or any error
   *   documented by `GuildPlayer.play`.
   */
  async play(command: PlayCommand): Promise<PlayResult> {
    const { guildId, url, requestedBy, voiceChannelId } = command;
    if (voiceChannelId === undefined) throw new NotInVoiceChannelError();
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
