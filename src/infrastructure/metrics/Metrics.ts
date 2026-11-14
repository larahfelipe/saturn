import { collectDefaultMetrics, Counter, Gauge, Registry } from '@prometheus-io/client';

import type { CommandMetrics } from '../discord/InteractionHandler.ts';

export interface MetricsOptions {
  /** Command names to export at zero before their first use. */
  readonly commands: readonly string[];
  /** Read at scrape time, so the gauge cannot drift from the registry. */
  readonly activePlayers: () => number;
}

/** Saturn's Prometheus metrics plus the Node.js runtime and process defaults. */
export class Metrics implements CommandMetrics {
  readonly #registry = new Registry();
  readonly #commands: Counter<'command'>;

  constructor(options: MetricsOptions) {
    collectDefaultMetrics({ register: this.#registry });
    this.#commands = new Counter({
      name: 'saturn_commands_processed_total',
      help: 'The total number of commands processed by the bot',
      labelNames: ['command'],
      registers: [this.#registry],
    });
    for (const command of options.commands) this.#commands.inc({ command }, 0);

    const { activePlayers } = options;
    new Gauge({
      name: 'saturn_active_players',
      help: 'The number of active guild players running',
      registers: [this.#registry],
      collect() {
        this.set(Math.max(0, activePlayers()));
      },
    });
  }

  get contentType(): string {
    return this.#registry.contentType;
  }

  recordCommand(name: string): void {
    this.#commands.inc({ command: name });
  }

  /** The exposition text for a scrape. */
  render(): Promise<string> {
    return this.#registry.metrics();
  }
}
