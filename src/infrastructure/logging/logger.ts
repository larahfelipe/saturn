import pino from 'pino';

import type { AppEnvironment } from '../../config/environment.ts';

/** Keys that may carry credentials, at the top level or one object deep. */
const REDACTED_PATHS = ['token', 'botToken', 'authorization', 'cookie'].flatMap((key) => [
  key,
  `*.${key}`,
]);

/**
 * JSON logs on stdout. Development lowers the level to `debug`; `npm run dev`
 * pipes the output through pino-pretty for readability.
 */
export function createLogger(
  environment: AppEnvironment,
  destination?: pino.DestinationStream,
): pino.Logger {
  return pino(
    {
      level: environment === 'development' ? 'debug' : 'info',
      redact: { paths: REDACTED_PATHS, censor: '[Redacted]' },
    },
    destination,
  );
}

/** Writes out buffered log lines. Never rejects: there is nowhere left to report a failure. */
export function flushLogger(logger: pino.Logger): Promise<void> {
  return new Promise((resolve) => {
    logger.flush(() => {
      resolve();
    });
  });
}
