import type { AudioPlayer } from '@discordjs/voice';
import {
  Client,
  Collection,
  GatewayIntentBits,
  type Snowflake
} from 'discord.js';

import { APP_ACTIVITY, APP_COMMANDS_LOADED, APP_READY } from '@/constants';
import { UncaughtExceptionMonitorError } from '@/errors/UncaughtExceptionMonitorError';
import { UnhandledPromiseRejectionError } from '@/errors/UnhandledPromiseRejectionError';
import { ApplicationErrorHandler } from '@/handlers/ApplicationErrorHandler';
import { CommandsHandler } from '@/handlers/CommandsHandler';
import type { MessageChannelHandler } from '@/handlers/MessageChannelHandler';
import type { MusicPlaybackHandler } from '@/handlers/MusicPlaybackHandler';
import { PrismaClient } from '@/infra/PrismaClient';
import { ChannelMessagingUtils } from '@/utils/ChannelMessagingUtils';

import type { Command } from './Command';

export class Bot extends Client {
  private static INSTANCE: Bot;
  databaseClient!: PrismaClient;
  applicationErrorHandler!: ApplicationErrorHandler;
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
    this.maybeDatabaseConnection();
    this.onInteractionReady();
    this.onInteractionListening();
  }

  static getInstance() {
    if (!this.INSTANCE) this.INSTANCE = new Bot();
    return this.INSTANCE;
  }

  private async maybeDatabaseConnection() {
    this.databaseClient = PrismaClient.getInstance();
    await this.databaseClient.createConnection();

    this.applicationErrorHandler = ApplicationErrorHandler.getInstance(this);
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

  async makeDiscordAPIConnection(token: string) {
    const authToken = await this.login(token);
    return !!authToken;
  }
}
