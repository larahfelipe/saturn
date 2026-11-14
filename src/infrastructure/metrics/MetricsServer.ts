import { once } from 'node:events';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

import type { Logger } from '../../application/ports/Logger.ts';

export interface MetricsSource {
  readonly contentType: string;
  render(): Promise<string>;
}

export interface MetricsServerOptions {
  readonly source: MetricsSource;
  readonly logger: Logger;
}

/** Serves `GET /metrics` for Prometheus scrapes. */
export class MetricsServer {
  readonly #source: MetricsSource;
  readonly #logger: Logger;
  readonly #server: Server;

  constructor(options: MetricsServerOptions) {
    this.#source = options.source;
    this.#logger = options.logger;
    this.#server = createServer((request, response) => {
      void this.#handle(request, response);
    });
  }

  /** Listens on every interface. Pass port 0 to pick a free port. */
  async listen(port: number): Promise<AddressInfo> {
    this.#server.listen(port);
    await once(this.#server, 'listening');
    const address = this.#server.address() as AddressInfo;
    this.#logger.info({ port: address.port }, 'metrics endpoint listening');
    return address;
  }

  /** Stops listening and drops open connections, including idle keep-alive ones. Idempotent. */
  async close(): Promise<void> {
    if (!this.#server.listening) return;
    const closed = once(this.#server, 'close');
    this.#server.close();
    this.#server.closeAllConnections();
    await closed;
  }

  async #handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const path = new URL(request.url ?? '/', 'http://localhost').pathname;
    if (path !== '/metrics') {
      response.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not Found\n');
      return;
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response
        .writeHead(405, { 'Content-Type': 'text/plain', Allow: 'GET, HEAD' })
        .end('Method Not Allowed\n');
      return;
    }
    try {
      const body = await this.#source.render();
      response.writeHead(200, { 'Content-Type': this.#source.contentType }).end(body);
    } catch (error) {
      this.#logger.error({ err: error }, 'metrics collection failed');
      response.writeHead(500, { 'Content-Type': 'text/plain' }).end('Internal Server Error\n');
    }
  }
}
