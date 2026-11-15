import { Ytdl } from '@distube/ytdl-core';

import { PlaybackService } from './application/music/PlaybackService.ts';
import { PlayerRegistry } from './application/music/PlayerRegistry.ts';
import { ConfigurationError, loadConfig, type Config } from './config/environment.ts';
import { verifyFfmpeg } from './infrastructure/audio/ffmpeg.ts';
import { VoiceConnectionManager } from './infrastructure/audio/VoiceConnectionManager.ts';
import { CommandRegistry } from './infrastructure/discord/CommandRegistry.ts';
import { COMMAND_DEFINITIONS } from './infrastructure/discord/commandDefinitions.ts';
import { createCommandHandlers } from './infrastructure/discord/commands.ts';
import { DiscordClient } from './infrastructure/discord/DiscordClient.ts';
import { InteractionHandler } from './infrastructure/discord/InteractionHandler.ts';
import { createLogger, flushLogger } from './infrastructure/logging/logger.ts';
import { Metrics } from './infrastructure/metrics/Metrics.ts';
import { MetricsServer } from './infrastructure/metrics/MetricsServer.ts';
import {
  YOUTUBE_REQUEST_TIMEOUT_MS,
  YouTubeTrackResolver,
} from './infrastructure/youtube/YouTubeTrackResolver.ts';
import { GracefulShutdown } from './lifecycle/GracefulShutdown.ts';

const METRICS_PORT = 8080;

function readConfig(): Config | undefined {
  try {
    return loadConfig(process.env);
  } catch (error) {
    if (!(error instanceof ConfigurationError)) throw error;
    createLogger('production').error({ err: error }, 'invalid configuration');
    return undefined;
  }
}

async function main(): Promise<void> {
  const config = readConfig();
  if (config === undefined) {
    process.exitCode = 1;
    return;
  }
  const logger = createLogger(config.environment);

  const discord = new DiscordClient({
    token: config.botToken,
    activityStatus: config.activityStatus,
    logger,
  });
  const registry = new PlayerRegistry({
    resolver: new YouTubeTrackResolver(new Ytdl({ timeoutMs: YOUTUBE_REQUEST_TIMEOUT_MS })),
    voice: new VoiceConnectionManager({
      channels: (target) => discord.voiceChannel(target),
      ffmpegPath: config.ffmpegPath,
      logger,
    }),
    logger,
  });
  const playback = new PlaybackService(registry);
  const bot = () => discord.botProfile;
  const commands = new CommandRegistry(
    COMMAND_DEFINITIONS,
    createCommandHandlers({
      playback,
      definitions: COMMAND_DEFINITIONS,
      bot,
      heartbeatLatency: () => discord.heartbeatLatency,
    }),
  );
  const metrics = new Metrics({
    commands: COMMAND_DEFINITIONS.map(({ name }) => name),
    activePlayers: () => registry.activeCount(),
  });
  const metricsServer = new MetricsServer({ source: metrics, logger });
  const interactions = new InteractionHandler({ commands, playback, bot, metrics, logger });
  discord.onInteraction((interaction) => interactions.handle(interaction));

  // Players go first: closing the registry rejects new playback requests,
  // aborts streams, kills FFmpeg and leaves voice while the gateway is still up.
  const shutdown = new GracefulShutdown({
    steps: [
      {
        name: 'players',
        run: () => {
          registry.close();
        },
      },
      { name: 'discord gateway', run: () => discord.stop() },
      { name: 'metrics server', run: () => metricsServer.close() },
    ],
    logger,
    finalize: () => flushLogger(logger),
    exit: (code) => process.exit(code),
  });
  shutdown.install(process);
  discord.onGatewayLost(() => {
    void shutdown.run('discord gateway lost', 1);
  });

  try {
    await verifyFfmpeg(config.ffmpegPath);
    await metricsServer.listen(METRICS_PORT);
    await discord.start(commands);
  } catch (error) {
    // A signal during startup is already shutting down, which can fail the step in progress.
    if (shutdown.isRunning) return;
    logger.error({ err: error }, 'startup failed');
    await shutdown.run('startup failed', 1);
  }
}

await main();
