import pino from 'pino';

import type { AppEnvironment } from '../../config/environment.ts';

const REDACTED_PATHS = ['token', 'botToken', 'authorization', 'cookie'].flatMap((key) => [
  key,
  `*.${key}`,
]);

export function createLogger(
  environment: AppEnvironment,
  destination?: pino.DestinationStream,
): pino.Logger {
  return pino(
    {
      level: environment === 'development' ? 'debug' : 'info',
      redact: { censor: '[Redacted]', paths: REDACTED_PATHS },
    },
    destination,
  );
}

export function flushLogger(logger: pino.Logger): Promise<void> {
  return new Promise((resolve) => {
    logger.flush(() => {
      resolve();
    });
  });
}
