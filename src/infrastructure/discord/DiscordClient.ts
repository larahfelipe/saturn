import { once } from 'node:events';

import { ActivityType, Client, Events, GatewayIntentBits, type Interaction } from 'discord.js';

import type { Logger } from '../../application/ports/Logger.ts';
import type { VoiceTarget } from '../../application/ports/Voice.ts';
import type { VoiceChannelInfo } from '../audio/VoiceConnectionManager.ts';
import type { CommandRegistry } from './CommandRegistry.ts';
import type { BotProfile } from './replies.ts';

export interface DiscordClientOptions {
  readonly token: string;
  readonly activityStatus: string | undefined;
  readonly logger: Logger;
}

/** Owns the discord.js gateway client: login, command synchronization, presence and shutdown. */
export class DiscordClient {
  readonly #client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
  });
  readonly #token: string;
  readonly #activityStatus: string | undefined;
  readonly #logger: Logger;

  constructor(options: DiscordClientOptions) {
    this.#token = options.token;
    this.#activityStatus = options.activityStatus;
    this.#logger = options.logger;
    this.#client.on(Events.Error, (error) => {
      this.#logger.error({ err: error }, 'discord client error');
    });
    this.#client.on(Events.Warn, (message) => {
      this.#logger.warn({ detail: message }, 'discord client warning');
    });
    this.#client.on(Events.ShardDisconnect, (event, shardId) => {
      this.#logger.warn({ shardId, code: event.code }, 'discord gateway disconnected');
    });
    this.#client.on(Events.ShardResume, (shardId) => {
      this.#logger.info({ shardId }, 'discord gateway resumed');
    });
  }

  get botProfile(): BotProfile {
    const user = this.#client.user;
    return {
      username: user?.username ?? 'Saturn',
      avatarUrl: user?.displayAvatarURL({ size: 256 }),
    };
  }

  /** Gateway heartbeat round trip in milliseconds, or -1 before the first heartbeat. */
  get heartbeatLatency(): number {
    return this.#client.ws.ping;
  }

  onInteraction(handler: (interaction: Interaction) => Promise<void>): void {
    this.#client.on(Events.InteractionCreate, (interaction) => {
      void handler(interaction);
    });
  }

  voiceChannel(target: VoiceTarget): VoiceChannelInfo | undefined {
    const guild = this.#client.guilds.cache.get(target.guildId);
    const channel = guild?.channels.cache.get(target.channelId);
    if (guild === undefined || channel?.isVoiceBased() !== true) return undefined;
    return { adapterCreator: guild.voiceAdapterCreator, bitrate: channel.bitrate };
  }

  /** Connects to the gateway, then synchronizes slash commands and sets the custom status. */
  async start(commands: CommandRegistry): Promise<void> {
    const login = new AbortController();
    const ready = once(this.#client, Events.ClientReady, { signal: login.signal });
    // Observed here so that abandoning it after a failed login is not an unhandled rejection.
    ready.catch(() => undefined);
    try {
      await this.#client.login(this.#token);
      await ready;
    } catch (error) {
      login.abort();
      throw error;
    }
    const client = this.#client;
    if (!client.isReady()) throw new Error('Discord client is not ready');
    this.#logger.info({ user: client.user.tag, guilds: client.guilds.cache.size }, 'discord ready');

    await commands.sync(client.application.commands);
    this.#logger.info({ count: commands.definitions.length }, 'slash commands synchronized');

    if (this.#activityStatus !== undefined) {
      client.user.setActivity({ name: this.#activityStatus, type: ActivityType.Custom });
    }
  }

  /** Closes the gateway connection. Idempotent. */
  async stop(): Promise<void> {
    await this.#client.destroy();
  }
}
