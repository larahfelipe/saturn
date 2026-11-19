import { EventEmitter } from 'node:events';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { PlayerUnavailableError } from '../../../src/application/errors.ts';
import { PlaybackService } from '../../../src/application/music/PlaybackService.ts';
import type { PlayCommand } from '../../../src/application/music/PlaybackService.ts';
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
  return { guildId, requestedBy: 'user', url: trackUrl('aaaaaaaaaaa'), voiceChannelId: 'voice-1' };
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
    registry = new PlayerRegistry({ logger, resolver: new FakeResolver(), voice });
    playback = new PlaybackService(registry);
    const metrics = new Metrics({
      activePlayers: () => registry.activeCount(),
      commands: ['play'],
    });
    metricsServer = new MetricsServer({ logger, source: metrics });
    const { port } = await metricsServer.listen(0);
    metricsUrl = `http://127.0.0.1:${port}/metrics`;
  });

  afterEach(async () => {
    await metricsServer.close();
  });

  async function activePlayers(): Promise<number> {
    const response = await fetch(metricsUrl);
    const body = await response.text();
    return Number(/^saturn_active_players (\d+)$/m.exec(body)?.[1]);
  }

  it('releases playback before closing the gateway, then stops serving metrics', async () => {
    const process = new EventEmitter();
    const { promise: exited, resolve: exit } = Promise.withResolvers<number>();
    let gatewayClosedWith: { aborted: boolean[]; destroyed: boolean[] } | undefined;
    new GracefulShutdown({
      exit,
      finalize: () => Promise.resolve(),
      logger,
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
              aborted: voice.sessions.map(({ current }) => current?.signal.aborted === true),
              destroyed: voice.sessions.map(({ destroyed }) => destroyed),
            };
          },
        },
        { name: 'metrics server', run: () => metricsServer.close() },
      ],
    }).install(process);

    await Promise.all([playback.play(command('guild-1')), playback.play(command('guild-2'))]);
    await flush();
    await expect(activePlayers()).resolves.toBe(2);

    process.emit('SIGTERM');

    await expect(exited).resolves.toBe(0);
    expect(gatewayClosedWith).toEqual({ aborted: [true, true], destroyed: [true, true] });
    expect(registry.activeCount()).toBe(0);
    await expect(playback.play(command('guild-1'))).rejects.toThrow(PlayerUnavailableError);
    await expect(fetch(metricsUrl)).rejects.toThrow(TypeError);
    expect(logger.at('error')).toEqual([]);
  });
});
