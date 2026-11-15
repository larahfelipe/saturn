import { VoiceConnectionStatus, type DiscordGatewayAdapterCreator } from '@discordjs/voice';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  VoiceChannelUnusableError,
  VoiceConnectionError,
} from '../../../src/application/errors.ts';
import type { VoiceTarget } from '../../../src/application/ports/Voice.ts';
import { DiscordAudioSession } from '../../../src/infrastructure/audio/DiscordAudioSession.ts';
import {
  VoiceConnectionManager,
  type JoinVoiceChannel,
} from '../../../src/infrastructure/audio/VoiceConnectionManager.ts';
import { fakeFfmpeg } from '../../fixtures/audio.ts';
import { flush, RecordingLogger } from '../../fixtures/fakes.ts';
import { FakeVoiceConnection } from '../../fixtures/voice.ts';

const TARGET: VoiceTarget = { guildId: 'guild-1', channelId: 'voice-1' };
const adapterCreator: DiscordGatewayAdapterCreator = () => ({
  sendPayload: () => true,
  destroy: () => undefined,
});

describe('VoiceConnectionManager', () => {
  let connections: FakeVoiceConnection[];
  let joins: Parameters<JoinVoiceChannel>[0][];
  let logger: RecordingLogger;
  let manager: VoiceConnectionManager;

  const options = (signal = new AbortController().signal) => ({ signal, onLost: () => undefined });

  beforeEach(() => {
    connections = [];
    joins = [];
    logger = new RecordingLogger();
    manager = new VoiceConnectionManager({
      channels: (target) => {
        if (target.channelId === 'stage-1') throw new VoiceChannelUnusableError('stage');
        return target.channelId === TARGET.channelId
          ? { adapterCreator, bitrate: 64_000 }
          : undefined;
      },
      ffmpegPath: fakeFfmpeg('passthrough'),
      logger,
      joinTimeoutMs: 100,
      join: (config) => {
        joins.push(config);
        const connection = new FakeVoiceConnection();
        connections.push(connection);
        return connection.asConnection();
      },
    });
  });

  it('joins the channel deafened and unmuted, and returns a session once ready', async () => {
    const pending = manager.connect(TARGET, options());
    await flush();
    connections[0]?.setStatus(VoiceConnectionStatus.Ready);

    const session = await pending;

    expect(session).toBeInstanceOf(DiscordAudioSession);
    expect(joins).toEqual([{ ...TARGET, adapterCreator, selfDeaf: true, selfMute: false }]);
    expect(connections[0]?.subscriptions).toHaveLength(1);
    session.destroy();
    expect(connections[0]?.destroyCount).toBe(1);
  });

  it('rejects an unknown channel without joining', async () => {
    await expect(manager.connect({ ...TARGET, channelId: 'text-1' }, options())).rejects.toThrow(
      new VoiceConnectionError('Voice channel is not available'),
    );
    expect(joins).toHaveLength(0);
  });

  it('rejects a channel the bot cannot play in without joining', async () => {
    const error = manager.connect({ ...TARGET, channelId: 'stage-1' }, options());

    await expect(error).rejects.toThrow(VoiceChannelUnusableError);
    expect(joins).toHaveLength(0);
  });

  it('gives up and disconnects when the connection does not become ready in time', async () => {
    await expect(manager.connect(TARGET, options())).rejects.toThrow(
      new VoiceConnectionError('Could not join the voice channel'),
    );
    expect(connections[0]?.destroyCount).toBe(1);
  });

  it('fails as soon as the connection is destroyed while joining', async () => {
    const pending = manager.connect(TARGET, options());
    await flush();

    connections[0]?.setStatus(VoiceConnectionStatus.Destroyed);

    await expect(pending).rejects.toThrow(VoiceConnectionError);
    expect(connections[0]?.destroyCount).toBe(0);
  });

  it('disconnects and rejects with the abort reason when cancelled while joining', async () => {
    const controller = new AbortController();
    const pending = manager.connect(TARGET, options(controller.signal));
    await flush();
    const reason = new Error('stopped');

    controller.abort(reason);

    await expect(pending).rejects.toBe(reason);
    expect(connections[0]?.destroyCount).toBe(1);
  });

  it('does not join when already cancelled', async () => {
    const reason = new Error('stopped');

    await expect(manager.connect(TARGET, options(AbortSignal.abort(reason)))).rejects.toBe(reason);
    expect(joins).toHaveLength(0);
  });

  it('logs connection errors with the voice target', async () => {
    const pending = manager.connect(TARGET, options());
    await flush();
    connections[0]?.emit('error', new Error('udp socket closed'));
    connections[0]?.setStatus(VoiceConnectionStatus.Ready);
    (await pending).destroy();

    expect(logger.at('warn')).toMatchObject([
      { message: 'voice connection error', context: { guildId: 'guild-1', channelId: 'voice-1' } },
    ]);
  });
});
