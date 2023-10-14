import type { AudioPlayer } from '@discordjs/voice';
import {
  Client,
  Collection,
  GatewayIntentBits,
  type Snowflake
} from 'discord.js';

import config from '@/config';
import {
  APP_ACTIVITY,
  APP_COMMANDS_LOADED,
  APP_MISSING_REQUIRED_CREDENTIALS,
  APP_READY
} from '@/constants';
import { MissingRequiredCredentialsError } from '@/errors/MissingRequiredCredentialsError';
import { UncaughtExceptionMonitorError } from '@/errors/UncaughtExceptionMonitorError';
import { UnhandledPromiseRejectionError } from '@/errors/UnhandledPromiseRejectionError';
import { AppErrorHandler } from '@/handlers/AppErrorHandler';
import { CommandsHandler } from '@/handlers/CommandsHandler';
import type { MessageChannelHandler } from '@/handlers/MessageChannelHandler';
import type { MusicPlaybackHandler } from '@/handlers/MusicPlaybackHandler';
import { PrismaClient } from '@/infra/PrismaClient';
import { ChannelMessagingUtils } from '@/utils/ChannelMessagingUtils';

import type { Command } from './Command';

export class Bot extends Client {
  private static INSTANCE: Bot;
  databaseClient!: PrismaClient;
  appErrorHandler!: AppErrorHandler;
  commandsHandler!: CommandsHandler;
  musicPlaybackHandler!: MusicPlaybackHandler;
  messageChannelHandler!: MessageChannelHandler;
  commands!: Collection<Snowflake, Command>;
  subscriptions!: Map<Snowflake, AudioPlayer>;

  private constructor() {
    super({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates
      ]
    });
    this.validateCredentials();
    this.maybeDatabaseConnection();
    this.onInteractionReady();
    this.onInteractionListening();
    this.makeDiscordAPIConnection();
  }

  static getInstance() {
    if (!this.INSTANCE) this.INSTANCE = new Bot();
    return this.INSTANCE;
  }

  private validateCredentials() {
    const { botToken, botAppId, guildId } = config;

    if (!botToken || !botAppId || !guildId) {
      throw new MissingRequiredCredentialsError(
        APP_MISSING_REQUIRED_CREDENTIALS
      );
    }
  }

  private async maybeDatabaseConnection() {
    this.databaseClient = PrismaClient.getInstance();
    await this.databaseClient.createConnection();

    this.appErrorHandler = AppErrorHandler.getInstance(this);
  }

  private async onInteractionReady() {
    this.commands = new Collection();
    this.subscriptions = new Map();
    this.commandsHandler = CommandsHandler.getInstance(this);
    const isCommandsLoaded = await this.commandsHandler.loadCommands();
    if (isCommandsLoaded) console.log(APP_COMMANDS_LOADED);

    this.once('ready', () => {
      console.log(APP_READY);
      this.user?.setActivity(APP_ACTIVITY);
    });

    process.on(
      'unhandledRejection',
      ({ message }: Error) =>
        new UnhandledPromiseRejectionError({ message, bot: this })
    );
    process.on(
      'uncaughtExceptionMonitor',
      ({ message }: Error) =>
        new UncaughtExceptionMonitorError({ message, bot: this })
    );
  }

  private onInteractionListening() {
    this.on('interactionCreate', async (interaction) => {
      try {
        await this.commandsHandler.execute(interaction);
      } catch (e) {
        console.error(e);
        await ChannelMessagingUtils.makeBotCommandErrorEmbed(interaction);
      }
    });
  }

  private async makeDiscordAPIConnection() {
    try {
      await this.login(config.botToken);
    } catch (e) {
      console.error(e);
    }
  }
}
