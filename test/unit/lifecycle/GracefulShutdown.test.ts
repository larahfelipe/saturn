import { EventEmitter } from 'node:events';

import { beforeEach, describe, expect, it } from 'vitest';

import { GracefulShutdown, type ShutdownStep } from '../../../src/lifecycle/GracefulShutdown.ts';
import { flush, RecordingLogger } from '../../fixtures/fakes.ts';

describe('GracefulShutdown', () => {
  let events: string[];
  let exits: number[];
  let logger: RecordingLogger;

  beforeEach(() => {
    events = [];
    exits = [];
    logger = new RecordingLogger();
  });

  function step(name: string, run: () => Promise<void> | void = () => undefined): ShutdownStep {
    return {
      name,
      run: () => {
        events.push(name);
        return run();
      },
    };
  }

  function shutdown(steps: readonly ShutdownStep[], stepTimeoutMs = 1000): GracefulShutdown {
    return new GracefulShutdown({
      steps,
      logger,
      stepTimeoutMs,
      finalize: () => {
        events.push('finalize');
        return Promise.resolve();
      },
      exit: (code) => {
        events.push('exit');
        exits.push(code);
      },
    });
  }

  it('runs the steps in order, then finalizes and exits', async () => {
    await shutdown([step('players'), step('gateway'), step('metrics')]).run('SIGTERM');

    expect(events).toEqual(['players', 'gateway', 'metrics', 'finalize', 'exit']);
    expect(exits).toEqual([0]);
    expect(logger.contextOf('info', 'shutting down')).toEqual({ reason: 'SIGTERM' });
    expect(logger.contextOf('info', 'shutdown complete')).toEqual({ exitCode: 0 });
  });

  it('waits for each step before starting the next', async () => {
    const { promise: gatewayClosed, resolve } = Promise.withResolvers<undefined>();
    const running = shutdown([step('gateway', () => gatewayClosed), step('metrics')]).run('x');

    await flush();
    expect(events).toEqual(['gateway']);
    resolve(undefined);
    await running;
    expect(events).toEqual(['gateway', 'metrics', 'finalize', 'exit']);
  });

  it('runs once however many times it is requested', async () => {
    const coordinator = shutdown([step('players')]);

    const first = coordinator.run('SIGTERM');
    const second = coordinator.run('SIGINT', 1);

    expect(second).toBe(first);
    await first;
    expect(events).toEqual(['players', 'finalize', 'exit']);
    expect(exits).toEqual([0]);
    expect(coordinator.isRunning).toBe(true);
  });

  it.each([
    [
      'throws',
      () => {
        throw new Error('boom');
      },
    ],
    ['rejects', () => Promise.reject(new Error('boom'))],
  ])('continues past a step that %s and exits with 1', async (_, run) => {
    await shutdown([step('gateway', run), step('metrics')]).run('SIGTERM');

    expect(events).toEqual(['gateway', 'metrics', 'finalize', 'exit']);
    expect(exits).toEqual([1]);
    expect(logger.contextOf('error', 'shutdown step failed')).toMatchObject({
      step: 'gateway',
      err: new Error('boom'),
    });
  });

  it('abandons a step that exceeds its timeout', async () => {
    const hung = step('gateway', () => new Promise<void>(() => undefined));

    await shutdown([hung, step('metrics')], 20).run('SIGTERM');

    expect(events).toEqual(['gateway', 'metrics', 'finalize', 'exit']);
    expect(exits).toEqual([1]);
    expect(logger.contextOf('error', 'shutdown step timed out')).toEqual({
      step: 'gateway',
      timeoutMs: 20,
    });
  });

  it('keeps the requested exit code when every step succeeds', async () => {
    await shutdown([step('players')]).run('startup failed', 1);

    expect(exits).toEqual([1]);
  });

  describe('process events', () => {
    let target: EventEmitter;

    beforeEach(() => {
      target = new EventEmitter();
    });

    it.each(['SIGINT', 'SIGTERM'])('shuts down on %s', async (signal) => {
      shutdown([step('players')]).install(target);

      target.emit(signal);
      await flush();

      expect(events).toEqual(['players', 'finalize', 'exit']);
      expect(exits).toEqual([0]);
      expect(logger.contextOf('info', 'shutting down')).toEqual({ reason: signal });
    });

    it('exits immediately on a second signal', async () => {
      const { promise: never } = Promise.withResolvers<undefined>();
      shutdown([step('gateway', () => never)]).install(target);

      target.emit('SIGTERM');
      await flush();
      target.emit('SIGINT');

      expect(events).toEqual(['gateway', 'exit']);
      expect(exits).toEqual([1]);
      expect(logger.contextOf('warn', 'forced exit')).toEqual({ signal: 'SIGINT' });
    });

    it.each([
      ['uncaughtException', 'uncaught exception'],
      ['unhandledRejection', 'unhandled rejection'],
    ])('shuts down with exit code 1 on %s', async (event, message) => {
      const error = new Error('boom');
      shutdown([step('players')]).install(target);

      target.emit(event, error);
      await flush();

      expect(events).toEqual(['players', 'finalize', 'exit']);
      expect(exits).toEqual([1]);
      expect(logger.contextOf('error', message)).toEqual({ err: error });
    });

    it('exits with 1 after a fatal error raised during shutdown, without restarting it', async () => {
      const { promise: gatewayClosed, resolve } = Promise.withResolvers<undefined>();
      shutdown([step('gateway', () => gatewayClosed)]).install(target);

      target.emit('SIGTERM');
      target.emit('uncaughtException', new Error('late'));
      resolve(undefined);
      await flush();

      expect(events).toEqual(['gateway', 'finalize', 'exit']);
      expect(exits).toEqual([1]);
      expect(logger.at('error')).toHaveLength(1);
    });
  });
});
