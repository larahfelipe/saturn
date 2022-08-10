import type { AudioPlayer } from '@discordjs/voice';
import {
  Client,
  Collection,
  GatewayIntentBits,
  type Snowflake
} from 'discord.js';

import config from '@/config';
import {
  APP_COMMANDS_LOADED,
  APP_MISSING_REQUIRED_CREDENTIALS,
  APP_READY
} from '@/constants';
import { InvalidAppCommandError } from '@/errors/InvalidAppCommandError';
import { MissingRequiredCredentialsError } from '@/errors/MissingRequiredCredentialsError';
import { UncaughtExceptionMonitorError } from '@/errors/UncaughtExceptionMonitorError';
import { UnhandledPromiseRejectionError } from '@/errors/UnhandledPromiseRejectionError';
import { AppErrorHandler } from '@/handlers/AppErrorHandler';
import { CommandsHandler } from '@/handlers/CommandsHandler';
import { MessageChannelHandler } from '@/handlers/MessageChannelHandler';
import { PrismaClient } from '@/infra/PrismaClient';

import type { Command } from './Command';

export class Bot extends Client {
  private static INSTANCE: Bot;
  databaseClient!: PrismaClient;
  appErrorHandler!: AppErrorHandler;
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
    this.subscriptions = new Map();
    const isCommandsLoaded = await new CommandsHandler(this).loadCommands();
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
      this.messageChannelHandler =
        MessageChannelHandler.getInstance(interaction);
      // const embed = Embed.getInstance();

      this.user?.setActivity(`Orbiting in ${interaction.guild?.name}`);

      if (!interaction.isChatInputCommand()) return;

      try {
        await interaction.deferReply();

        console.log(`\n@${interaction.user.tag} -> ${interaction.commandName}`);

        const command = this.commands.get(interaction.commandName);

        if (!command)
          throw new InvalidAppCommandError({
            message: `${interaction.commandName} is not a valid command.`,
            bot: this,
            interaction
          });

        await command.execute(interaction);
      } catch (e) {
        console.error(e);

        // embed
        //   .setTitle('')
        //   .setAuthor({ name: APP_COMMAND_ERROR_TITLE })
        //   .setThumbnail('')
        //   .setDescription(APP_COMMAND_ERROR_DESCRIPTION)
        //   .setFooter({ text: '' })
        //   .setTimestamp({} as Date)
        //   .setColor(APP_ERROR_COLOR);
        // interaction.channel?.send({ embeds: [embed] });
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
