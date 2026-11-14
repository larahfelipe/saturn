import { EventEmitter } from 'node:events';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { PlayerUnavailableError } from '../../../src/application/errors.ts';
import {
  PlaybackService,
  type PlayCommand,
} from '../../../src/application/music/PlaybackService.ts';
import { PlayerRegistry } from '../../../src/application/music/PlayerRegistry.ts';
import { Metrics } from '../../../src/infrastructure/metrics/Metrics.ts';
import { MetricsServer } from '../../../src/infrastructure/metrics/MetricsServer.ts';
import { GracefulShutdown } from '../../../src/lifecycle/GracefulShutdown.ts';
import {
  FakeResolver,
  FakeVoiceConnector,
  flush,
  RecordingLogger,
  trackUrl,
} from '../../fixtures/fakes.ts';

function command(guildId: string): PlayCommand {
  return { guildId, url: trackUrl('aaaaaaaaaaa'), requestedBy: 'user', voiceChannelId: 'voice-1' };
}

describe('graceful shutdown', () => {
  let voice: FakeVoiceConnector;
  let logger: RecordingLogger;
  let registry: PlayerRegistry;
  let playback: PlaybackService;
  let metricsServer: MetricsServer;
  let metricsUrl: string;

  beforeEach(async () => {
    voice = new FakeVoiceConnector();
    logger = new RecordingLogger();
    registry = new PlayerRegistry({ resolver: new FakeResolver(), voice, logger });
    playback = new PlaybackService(registry);
    const metrics = new Metrics({
      commands: ['play'],
      activePlayers: () => registry.activeCount(),
    });
    metricsServer = new MetricsServer({ source: metrics, logger });
    const { port } = await metricsServer.listen(0);
    metricsUrl = `http://127.0.0.1:${port}/metrics`;
  });

  afterEach(async () => {
    await metricsServer.close();
  });

  async function activePlayers(): Promise<number> {
    const body = await (await fetch(metricsUrl)).text();
    return Number(/^saturn_active_players (\d+)$/m.exec(body)?.[1]);
  }

  it('releases playback before closing the gateway, then stops serving metrics', async () => {
    const process = new EventEmitter();
    const { promise: exited, resolve: exit } = Promise.withResolvers<number>();
    let gatewayClosedWith: { destroyed: boolean[]; aborted: boolean[] } | undefined;
    new GracefulShutdown({
      steps: [
        {
          name: 'players',
          run: () => {
            registry.close();
          },
        },
        {
          name: 'discord gateway',
          run: () => {
            gatewayClosedWith = {
              destroyed: voice.sessions.map(({ destroyed }) => destroyed),
              aborted: voice.sessions.map(({ current }) => current?.signal.aborted === true),
            };
          },
        },
        { name: 'metrics server', run: () => metricsServer.close() },
      ],
      logger,
      finalize: () => Promise.resolve(),
      exit,
    }).install(process);

    await Promise.all([playback.play(command('guild-1')), playback.play(command('guild-2'))]);
    await flush();
    expect(await activePlayers()).toBe(2);

    process.emit('SIGTERM');

    expect(await exited).toBe(0);
    expect(gatewayClosedWith).toEqual({ destroyed: [true, true], aborted: [true, true] });
    expect(registry.activeCount()).toBe(0);
    await expect(playback.play(command('guild-1'))).rejects.toThrow(PlayerUnavailableError);
    await expect(fetch(metricsUrl)).rejects.toThrow(TypeError);
    expect(logger.at('error')).toEqual([]);
  });
});
