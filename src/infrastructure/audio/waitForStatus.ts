import { VoiceConnectionStatus } from '@discordjs/voice';
import type { VoiceConnection, VoiceConnectionState } from '@discordjs/voice';

import { VoiceConnectionError } from '../../application/errors.ts';

export function waitForStatus(
  connection: VoiceConnection,
  statuses: readonly VoiceConnectionStatus[],
  signal: AbortSignal,
): Promise<void> {
  const { promise, reject, resolve } = Promise.withResolvers<undefined>();
  const settle = (status: VoiceConnectionStatus): boolean => {
    if (statuses.includes(status)) resolve(undefined);
    else if (status === VoiceConnectionStatus.Destroyed) {
      reject(new VoiceConnectionError('Voice connection was destroyed'));
    } else return false;
    return true;
  };
  if (settle(connection.state.status)) return promise;
  if (signal.aborted) return Promise.reject(signal.reason as Error);

  const onChange = (_: VoiceConnectionState, next: VoiceConnectionState): void => {
    if (settle(next.status)) cleanup();
  };
  const onAbort = (): void => {
    cleanup();
    reject(signal.reason as Error);
  };
  const cleanup = (): void => {
    connection.off('stateChange', onChange);
    signal.removeEventListener('abort', onAbort);
  };
  connection.on('stateChange', onChange);
  signal.addEventListener('abort', onAbort, { once: true });
  return promise;
}
