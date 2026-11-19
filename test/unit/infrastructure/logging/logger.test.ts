import { describe, expect, it } from 'vitest';

import { VoiceConnectionError } from '../../../../src/application/errors.ts';
import { createLogger, flushLogger } from '../../../../src/infrastructure/logging/logger.ts';

class MemoryDestination {
  flushCount = 0;
  readonly lines: Record<string, unknown>[] = [];

  flush(callback: () => void): void {
    this.flushCount++;
    callback();
  }

  write(line: string): void {
    this.lines.push(JSON.parse(line) as Record<string, unknown>);
  }
}

describe(createLogger, () => {
  it('logs info and above as JSON in production', () => {
    const destination = new MemoryDestination();
    const logger = createLogger('production', destination);

    logger.debug({}, 'hidden');
    logger.info({ guildId: '1' }, 'visible');

    expect(destination.lines).toEqual([
      expect.objectContaining({ guildId: '1', level: 30, msg: 'visible' }),
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
        authorization: 'c',
        botToken: 'b',
        config: { botToken: 'd', environment: 'production' },
        cookie: 'f',
        headers: { authorization: 'e', cookie: 'g' },
        token: 'a',
      },
      'secrets',
    );

    expect(destination.lines[0]).toMatchObject({
      authorization: '[Redacted]',
      botToken: '[Redacted]',
      config: { botToken: '[Redacted]', environment: 'production' },
      cookie: '[Redacted]',
      headers: { authorization: '[Redacted]', cookie: '[Redacted]' },
      token: '[Redacted]',
    });
    expect(JSON.stringify(destination.lines)).not.toMatch(/"[a-g]"/);
  });

  it('serializes errors with their causes', () => {
    const destination = new MemoryDestination();
    const logger = createLogger('production', destination);
    const error = new VoiceConnectionError('Voice connection lost', {
      cause: new Error('socket closed'),
    });

    logger.child({ guildId: '1' }).error({ err: error }, 'playback halted');

    expect(destination.lines[0]).toMatchObject({
      err: {
        message: 'Voice connection lost: socket closed',
        type: 'VoiceConnectionError',
      },
      guildId: '1',
      level: 50,
      msg: 'playback halted',
    });
  });
});

describe(flushLogger, () => {
  it('flushes the destination', async () => {
    const destination = new MemoryDestination();

    await flushLogger(createLogger('production', destination));

    expect(destination.flushCount).toBe(1);
  });
});
