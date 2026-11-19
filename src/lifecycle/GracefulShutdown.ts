import type { EventEmitter } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';

import type { Logger } from '../application/ports/Logger.ts';

export interface GracefulShutdownOptions {
  readonly exit: (code: number) => void;
  readonly finalize: () => Promise<void>;
  readonly logger: Logger;
  readonly steps: readonly ShutdownStep[];
  readonly stepTimeoutMs?: number;
}

export interface ShutdownStep {
  readonly name: string;
  run(): Promise<void> | void;
}

const TERMINATION_SIGNALS = ['SIGINT', 'SIGTERM'] as const;

export class GracefulShutdown {
  get isRunning(): boolean {
    return this.#running !== undefined;
  }

  readonly #exit: (code: number) => void;
  #fatalError = false;
  readonly #finalize: () => Promise<void>;
  readonly #logger: Logger;
  #running: Promise<void> | undefined;
  readonly #steps: readonly ShutdownStep[];
  readonly #stepTimeoutMs: number;

  constructor(options: GracefulShutdownOptions) {
    this.#steps = options.steps;
    this.#logger = options.logger;
    this.#finalize = options.finalize;
    this.#exit = options.exit;
    this.#stepTimeoutMs = options.stepTimeoutMs ?? 5000;
  }

  install(target: EventEmitter): void {
    for (const signal of TERMINATION_SIGNALS) {
      target.on(signal, () => {
        if (this.isRunning) {
          this.#logger.warn({ signal }, 'forced exit');
          this.#exit(1);
          return;
        }
        void this.run(signal);
      });
    }
    const fatal = (message: string) => (error: unknown) => {
      this.#logger.error({ err: error }, message);
      this.#fatalError = true;
      void this.run(message, 1);
    };
    target.on('uncaughtException', fatal('uncaught exception'));
    target.on('unhandledRejection', fatal('unhandled rejection'));
  }

  run(reason: string, exitCode = 0): Promise<void> {
    this.#running ??= this.#run(reason, exitCode);
    return this.#running;
  }

  async #run(reason: string, exitCode: number): Promise<void> {
    this.#logger.info({ reason }, 'shutting down');
    let succeeded = true;
    for (const step of this.#steps) {
      if (!(await this.#runStep(step))) succeeded = false;
    }
    const code = succeeded && !this.#fatalError ? exitCode : 1;
    this.#logger.info({ exitCode: code }, 'shutdown complete');
    await this.#finalize();
    this.#exit(code);
  }

  async #runStep(step: ShutdownStep): Promise<boolean> {
    const timer = new AbortController();
    try {
      const outcome = await Promise.race([
        Promise.try(() => step.run()).then(() => 'completed' as const),
        delay(this.#stepTimeoutMs, 'timed out' as const, { signal: timer.signal }),
      ]);
      if (outcome === 'timed out') {
        this.#logger.error(
          { step: step.name, timeoutMs: this.#stepTimeoutMs },
          'shutdown step timed out',
        );
        return false;
      }
      this.#logger.debug({ step: step.name }, 'shutdown step completed');
      return true;
    } catch (error) {
      this.#logger.error({ err: error, step: step.name }, 'shutdown step failed');
      return false;
    } finally {
      timer.abort();
    }
  }
}
