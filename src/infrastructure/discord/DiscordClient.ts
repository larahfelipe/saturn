import { once } from 'node:events';

import { ActivityType, ChannelType, Client, Events, GatewayIntentBits } from 'discord.js';
import type { Guild, Interaction, VoiceBasedChannel } from 'discord.js';

import { VoiceChannelUnusableError } from '../../application/errors.ts';
import type { VoiceChannelProblem } from '../../application/errors.ts';
import type { ListenerUpdate } from '../../application/music/PlaybackService.ts';
import type { Logger } from '../../application/ports/Logger.ts';
import type { VoiceTarget } from '../../application/ports/Voice.ts';
import type { VoiceChannelInfo } from '../audio/VoiceConnectionManager.ts';
import type { CommandRegistry } from './CommandRegistry.ts';
import type { BotProfile } from './replies.ts';

export interface DiscordClientOptions {
  readonly activityStatus: string | undefined;
  readonly logger: Logger;
  readonly token: string;
}

export class DiscordClient {
  get botProfile(): BotProfile {
    const user = this.#client.user;
    return {
      avatarUrl: user?.displayAvatarURL({ size: 256 }),
      username: user?.username ?? 'Saturn',
    };
  }
  get heartbeatLatency(): number {
    return this.#client.ws.ping;
  }

  readonly #activityStatus: string | undefined;
  readonly #client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
  });
  readonly #logger: Logger;
  #onGatewayLost: ((code: number) => void) | undefined;
  #stopping = false;
  readonly #token: string;

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
      if (this.#stopping) return;
      this.#logger.error({ code: event.code, shardId }, 'discord gateway closed permanently');
      this.#onGatewayLost?.(event.code);
    });
    this.#client.on(Events.ShardReconnecting, (shardId) => {
      if (this.#stopping) return;
      this.#logger.warn({ shardId }, 'discord gateway reconnecting');
    });
    this.#client.on(Events.ShardResume, (shardId) => {
      this.#logger.info({ shardId }, 'discord gateway resumed');
    });
  }

  onGatewayLost(handler: (code: number) => void): void {
    this.#onGatewayLost = handler;
  }

  onInteraction(handler: (interaction: Interaction) => Promise<void>): void {
    this.#client.on(Events.InteractionCreate, (interaction) => {
      void handler(interaction);
    });
  }

  onListenersChange(handler: (update: ListenerUpdate) => void): void {
    this.#client.on(Events.VoiceStateUpdate, (previous, current) => {
      const botId = this.#client.user?.id;
      if (botId === undefined || previous.channelId === current.channelId) return;
      const { guild } = current;
      const channelId = guild.voiceStates.cache.get(botId)?.channelId;
      if (!channelId || (channelId !== previous.channelId && channelId !== current.channelId)) {
        return;
      }
      handler({ channelId, guildId: guild.id, listeners: countListeners(guild, channelId, botId) });
    });
  }

  async start(commands: CommandRegistry): Promise<void> {
    const login = new AbortController();
    const ready = once(this.#client, Events.ClientReady, { signal: login.signal });
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
    this.#logger.info({ guilds: client.guilds.cache.size, user: client.user.tag }, 'discord ready');

    await commands.sync(client.application.commands);
    this.#logger.info({ count: commands.definitions.length }, 'slash commands synchronized');

    if (this.#activityStatus !== undefined) {
      client.user.setActivity({ name: this.#activityStatus, type: ActivityType.Custom });
    }
  }

  async stop(): Promise<void> {
    this.#stopping = true;
    await this.#client.destroy();
  }

  voiceChannel(target: VoiceTarget): VoiceChannelInfo | undefined {
    const guild = this.#client.guilds.cache.get(target.guildId);
    const channel = guild?.channels.cache.get(target.channelId);
    if (guild === undefined || channel?.isVoiceBased() !== true) return undefined;
    const problem = voiceChannelProblem(guild, channel);
    if (problem !== undefined) throw new VoiceChannelUnusableError(problem);
    return { adapterCreator: guild.voiceAdapterCreator, bitrate: channel.bitrate };
  }
}

function countListeners(guild: Guild, channelId: string, botId: string): number {
  return guild.voiceStates.cache.filter(
    (state) =>
      state.channelId === channelId && state.id !== botId && state.member?.user.bot !== true,
  ).size;
}

function voiceChannelProblem(
  guild: Guild,
  channel: VoiceBasedChannel,
): VoiceChannelProblem | undefined {
  if (channel.type === ChannelType.GuildStageVoice) return 'stage';
  if (channel.id === guild.afkChannelId) return 'afk';
  if (guild.members.me === null) return undefined;
  if (!channel.joinable) return channel.full ? 'full' : 'missing-permissions';
  if (!channel.speakable) return 'missing-permissions';
  return undefined;
}
