import {
  VoiceConnectionStatus,
  type VoiceConnection,
  type VoiceConnectionState,
} from '@discordjs/voice';

import { VoiceConnectionError } from '../../application/errors.ts';

/**
 * Resolves once `connection` is in one of `statuses`. Rejects with the abort
 * reason, or as soon as the connection is destroyed.
 */
export function waitForStatus(
  connection: VoiceConnection,
  statuses: readonly VoiceConnectionStatus[],
  signal: AbortSignal,
): Promise<void> {
  const { promise, resolve, reject } = Promise.withResolvers<undefined>();
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
