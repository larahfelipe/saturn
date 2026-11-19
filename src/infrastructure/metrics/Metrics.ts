import { collectDefaultMetrics, Counter, Gauge, Registry } from '@prometheus-io/client';

import type { CommandMetrics } from '../discord/InteractionHandler.ts';

export interface MetricsOptions {
  readonly activePlayers: () => number;
  readonly commands: readonly string[];
}

export class Metrics implements CommandMetrics {
  get contentType(): string {
    return this.#registry.contentType;
  }

  readonly #commands: Counter<'command'>;
  readonly #registry = new Registry();

  constructor(options: MetricsOptions) {
    collectDefaultMetrics({ register: this.#registry });
    this.#commands = new Counter({
      help: 'The total number of commands processed by the bot',
      labelNames: ['command'],
      name: 'saturn_commands_processed_total',
      registers: [this.#registry],
    });
    for (const command of options.commands) this.#commands.inc({ command }, 0);

    const { activePlayers } = options;
    new Gauge({
      collect() {
        this.set(Math.max(0, activePlayers()));
      },
      help: 'The number of active guild players running',
      name: 'saturn_active_players',
      registers: [this.#registry],
    });
  }

  recordCommand(name: string): void {
    this.#commands.inc({ command: name });
  }

  render(): Promise<string> {
    return this.#registry.metrics();
  }
}
