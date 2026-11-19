import { once } from 'node:events';
import { createServer } from 'node:http';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

import type { Logger } from '../../application/ports/Logger.ts';

export interface MetricsServerOptions {
  readonly logger: Logger;
  readonly source: MetricsSource;
}

export interface MetricsSource {
  readonly contentType: string;
  render(): Promise<string>;
}

export class MetricsServer {
  readonly #logger: Logger;
  readonly #server: Server;
  readonly #source: MetricsSource;

  constructor(options: MetricsServerOptions) {
    this.#source = options.source;
    this.#logger = options.logger;
    this.#server = createServer((request, response) => {
      void this.#handle(request, response);
    });
  }

  async close(): Promise<void> {
    if (!this.#server.listening) return;
    const closed = once(this.#server, 'close');
    this.#server.close();
    this.#server.closeAllConnections();
    await closed;
  }

  async listen(port: number): Promise<AddressInfo> {
    this.#server.listen(port);
    await once(this.#server, 'listening');
    const address = this.#server.address() as AddressInfo;
    this.#logger.info({ port: address.port }, 'metrics endpoint listening');
    return address;
  }

  async #handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const path = new URL(request.url ?? '/', 'http://localhost').pathname;
    if (path !== '/metrics') {
      response.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not Found\n');
      return;
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response
        .writeHead(405, { Allow: 'GET, HEAD', 'Content-Type': 'text/plain' })
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
