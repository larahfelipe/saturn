import type { AudioPlayer } from '@discordjs/voice';
import {
  Client,
  Collection,
  GatewayIntentBits,
  type CommandInteraction,
  type Snowflake
} from 'discord.js';

import config from '@/config';
import {
  APP_COMMANDS_LOADED,
  APP_MISSING_REQUIRED_CREDENTIALS,
  APP_READY
} from '@/constants';
import { MissingRequiredCredentialsError } from '@/errors/MissingRequiredCredentialsError';
import { UncaughtExceptionMonitorError } from '@/errors/UncaughtExceptionMonitorError';
import { UnhandledPromiseRejectionError } from '@/errors/UnhandledPromiseRejectionError';
import { AppErrorHandler } from '@/handlers/AppErrorHandler';
import { CommandsHandler } from '@/handlers/CommandsHandler';
import { MessageChannelHandler } from '@/handlers/MessageChannelHandler';
import { MusicPlaybackHandler } from '@/handlers/MusicPlaybackHandler';
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
    this.validateRequiredCredentials();
    this.maybeMakeDatabaseConnection();
    this.onCreateInteraction();
    this.onListeningInteraction();
    this.makeDiscordAPIConnection();
  }

  static getInstance() {
    if (!this.INSTANCE) this.INSTANCE = new Bot();
    return this.INSTANCE;
  }

  private validateRequiredCredentials() {
    const { botToken, botAppId, guildId } = config;

    if (!botToken || !botAppId || !guildId) {
      throw new MissingRequiredCredentialsError(
        APP_MISSING_REQUIRED_CREDENTIALS
      );
    }
  }

  private async maybeMakeDatabaseConnection() {
    this.databaseClient = PrismaClient.getInstance();
    await this.databaseClient.createConnection();

    this.appErrorHandler = AppErrorHandler.getInstance(this);
  }

  private async onCreateInteraction() {
    this.commands = new Collection();
    this.commandsHandler = CommandsHandler.getInstance(this);
    this.subscriptions = new Map();
    const isCommandsLoaded = await this.commandsHandler.loadCommands();
    if (isCommandsLoaded) console.log(APP_COMMANDS_LOADED);

    this.once('ready', () => console.log(APP_READY));

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

  private onListeningInteraction() {
    this.on('interactionCreate', async (interaction) => {
      this.musicPlaybackHandler = MusicPlaybackHandler.getInstance(
        this,
        interaction as CommandInteraction
      );
      this.messageChannelHandler =
        MessageChannelHandler.getInstance(interaction);

      this.user?.setActivity(`Orbiting in ${interaction.guild?.name}`);

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
