import { describe, expect, it } from 'vitest';

import { Metrics } from '../../../../src/infrastructure/metrics/Metrics.ts';

function sample(text: string, series: string): number | undefined {
  const line = text.split('\n').find((candidate) => candidate.startsWith(`${series} `));
  return line === undefined ? undefined : Number(line.slice(series.length + 1));
}

describe(Metrics, () => {
  it('exports every command counter at zero before its first use', async () => {
    const metrics = new Metrics({ activePlayers: () => 0, commands: ['play', 'stop'] });

    const text = await metrics.render();

    expect(text).toContain(
      '# HELP saturn_commands_processed_total The total number of commands processed by the bot',
    );
    expect(text).toContain('# TYPE saturn_commands_processed_total counter');
    expect(sample(text, 'saturn_commands_processed_total{command="play"}')).toBe(0);
    expect(sample(text, 'saturn_commands_processed_total{command="stop"}')).toBe(0);
  });

  it('counts commands by name', async () => {
    const metrics = new Metrics({ activePlayers: () => 0, commands: ['play', 'stop'] });

    metrics.recordCommand('play');
    metrics.recordCommand('play');
    metrics.recordCommand('help');

    const text = await metrics.render();
    expect(sample(text, 'saturn_commands_processed_total{command="play"}')).toBe(2);
    expect(sample(text, 'saturn_commands_processed_total{command="stop"}')).toBe(0);
    expect(sample(text, 'saturn_commands_processed_total{command="help"}')).toBe(1);
  });

  it('reads the active players at scrape time', async () => {
    let active = 3;
    const metrics = new Metrics({ activePlayers: () => active, commands: [] });

    const first = await metrics.render();
    active = 1;
    const second = await metrics.render();

    expect(first).toContain(
      '# HELP saturn_active_players The number of active guild players running',
    );
    expect(first).toContain('# TYPE saturn_active_players gauge');
    expect(sample(first, 'saturn_active_players')).toBe(3);
    expect(sample(second, 'saturn_active_players')).toBe(1);
  });

  it('never exports a negative player count', async () => {
    const metrics = new Metrics({ activePlayers: () => -1, commands: [] });

    expect(sample(await metrics.render(), 'saturn_active_players')).toBe(0);
  });

  it('includes runtime and process metrics', async () => {
    const metrics = new Metrics({ activePlayers: () => 0, commands: [] });

    const text = await metrics.render();

    expect(text).toContain('process_cpu_user_seconds_total');
    expect(text).toContain('nodejs_eventloop_lag_seconds');
    expect(metrics.contentType).toMatch(/^text\/plain; version=0\.0\.4/);
  });

  it('keeps instances independent', async () => {
    const first = new Metrics({ activePlayers: () => 0, commands: [] });
    const second = new Metrics({ activePlayers: () => 0, commands: [] });

    first.recordCommand('ping');

    expect(
      sample(await second.render(), 'saturn_commands_processed_total{command="ping"}'),
    ).toBeUndefined();
  });
});
