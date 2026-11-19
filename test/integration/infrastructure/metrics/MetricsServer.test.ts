import { afterEach, describe, expect, it } from 'vitest';

import { MetricsServer } from '../../../../src/infrastructure/metrics/MetricsServer.ts';
import type { MetricsSource } from '../../../../src/infrastructure/metrics/MetricsServer.ts';
import { RecordingLogger } from '../../../fixtures/fakes.ts';

const CONTENT_TYPE = 'text/plain; version=0.0.4; charset=utf-8';

class StaticSource implements MetricsSource {
  readonly contentType = CONTENT_TYPE;
  failWith: Error | undefined;

  render(): Promise<string> {
    return this.failWith === undefined
      ? Promise.resolve('saturn_active_players 0\n')
      : Promise.reject(this.failWith);
  }
}

describe(MetricsServer, () => {
  let logger: RecordingLogger;
  let source: StaticSource;
  let server: MetricsServer;
  let base: string;

  async function start(): Promise<void> {
    logger = new RecordingLogger();
    source = new StaticSource();
    server = new MetricsServer({ logger, source });
    const { port } = await server.listen(0);
    base = `http://127.0.0.1:${port}`;
  }

  afterEach(async () => {
    await server.close();
  });

  it('serves the metrics', async () => {
    await start();

    const response = await fetch(`${base}/metrics`);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe(CONTENT_TYPE);
    await expect(response.text()).resolves.toBe('saturn_active_players 0\n');
    expect(logger.contextOf('info', 'metrics endpoint listening')).toEqual({
      port: Number(new URL(base).port),
    });
  });

  it('ignores the query string and answers HEAD', async () => {
    await start();

    await expect(fetch(`${base}/metrics?name[]=saturn_active_players`)).resolves.toHaveProperty(
      'status',
      200,
    );
    const head = await fetch(`${base}/metrics`, { method: 'HEAD' });
    expect(head.status).toBe(200);
    await expect(head.text()).resolves.toBe('');
  });

  it('rejects other paths and methods', async () => {
    await start();

    await expect(fetch(`${base}/`)).resolves.toHaveProperty('status', 404);
    await expect(fetch(`${base}/metrics/extra`)).resolves.toHaveProperty('status', 404);
    const post = await fetch(`${base}/metrics`, { method: 'POST' });
    expect(post.status).toBe(405);
    expect(post.headers.get('allow')).toBe('GET, HEAD');
  });

  it('reports collection failures', async () => {
    await start();
    source.failWith = new Error('collector broke');

    const response = await fetch(`${base}/metrics`);

    expect(response.status).toBe(500);
    await expect(response.text()).resolves.toBe('Internal Server Error\n');
    expect(logger.contextOf('error', 'metrics collection failed')).toEqual({
      err: source.failWith,
    });
  });

  it('drops in-flight scrapes and stops listening when closed', async () => {
    await start();
    const { promise: rendering, resolve: rendered } = Promise.withResolvers<undefined>();
    source.render = () => {
      rendered(undefined);
      return new Promise<string>(() => undefined);
    };

    const scrape = fetch(`${base}/metrics`);
    await rendering;
    await server.close();

    await expect(scrape).rejects.toThrow('fetch failed');
    await expect(fetch(`${base}/metrics`)).rejects.toThrow('fetch failed');
  });

  it('fails to listen on a port that is in use', async () => {
    await start();
    const other = new MetricsServer({ logger, source });

    await expect(other.listen(Number(new URL(base).port))).rejects.toMatchObject({
      code: 'EADDRINUSE',
    });
    await other.close();
  });

  it('can be closed before it listens', async () => {
    logger = new RecordingLogger();
    server = new MetricsServer({ logger, source: new StaticSource() });

    await expect(server.close()).resolves.toBeUndefined();
  });
});
