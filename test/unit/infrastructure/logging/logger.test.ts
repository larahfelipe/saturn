import { describe, expect, it } from 'vitest';

import { VoiceConnectionError } from '../../../../src/application/errors.ts';
import { createLogger, flushLogger } from '../../../../src/infrastructure/logging/logger.ts';

class MemoryDestination {
  readonly lines: Record<string, unknown>[] = [];
  flushCount = 0;

  write(line: string): void {
    this.lines.push(JSON.parse(line) as Record<string, unknown>);
  }

  flush(callback: () => void): void {
    this.flushCount++;
    callback();
  }
}

describe('createLogger', () => {
  it('logs info and above as JSON in production', () => {
    const destination = new MemoryDestination();
    const logger = createLogger('production', destination);

    logger.debug({}, 'hidden');
    logger.info({ guildId: '1' }, 'visible');

    expect(destination.lines).toEqual([
      expect.objectContaining({ level: 30, guildId: '1', msg: 'visible' }),
    ]);
  });

  it('includes debug logs in development', () => {
    const destination = new MemoryDestination();
    const logger = createLogger('development', destination);

    logger.debug({}, 'details');

    expect(destination.lines).toEqual([expect.objectContaining({ level: 20, msg: 'details' })]);
  });

  it('redacts credentials at the top level and one object deep', () => {
    const destination = new MemoryDestination();
    const logger = createLogger('production', destination);

    logger.info(
      {
        token: 'a',
        botToken: 'b',
        authorization: 'c',
        config: { botToken: 'd', environment: 'production' },
        headers: { authorization: 'e' },
      },
      'secrets',
    );

    expect(destination.lines[0]).toMatchObject({
      token: '[Redacted]',
      botToken: '[Redacted]',
      authorization: '[Redacted]',
      config: { botToken: '[Redacted]', environment: 'production' },
      headers: { authorization: '[Redacted]' },
    });
    expect(JSON.stringify(destination.lines)).not.toMatch(/"[a-e]"/);
  });

  it('serializes errors with their causes', () => {
    const destination = new MemoryDestination();
    const logger = createLogger('production', destination);
    const error = new VoiceConnectionError('Voice connection lost', {
      cause: new Error('socket closed'),
    });

    logger.child({ guildId: '1' }).error({ err: error }, 'playback halted');

    expect(destination.lines[0]).toMatchObject({
      level: 50,
      guildId: '1',
      msg: 'playback halted',
      err: {
        type: 'VoiceConnectionError',
        message: 'Voice connection lost: socket closed',
      },
    });
  });
});

describe('flushLogger', () => {
  it('flushes the destination', async () => {
    const destination = new MemoryDestination();

    await flushLogger(createLogger('production', destination));

    expect(destination.flushCount).toBe(1);
  });
});
