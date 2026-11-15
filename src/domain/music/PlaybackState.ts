import { InvalidPlaybackTransitionError } from './errors.ts';

export type PlaybackState<T> =
  | { readonly status: 'idle' }
  | { readonly status: 'connecting' }
  | { readonly status: 'playing'; readonly current: T }
  | { readonly status: 'paused'; readonly current: T }
  | { readonly status: 'waiting' }
  | { readonly status: 'stopping' };

export type PlaybackStatus = PlaybackState<unknown>['status'];

export type PlaybackEvent<T> =
  | { readonly type: 'connect' }
  | { readonly type: 'start'; readonly track: T }
  | { readonly type: 'pause' }
  | { readonly type: 'resume' }
  | { readonly type: 'wait' }
  | { readonly type: 'finish' }
  | { readonly type: 'stop' }
  | { readonly type: 'stopped' };

export const IDLE: PlaybackState<never> = Object.freeze({ status: 'idle' });

/**
 * Pure transition function of the guild playback lifecycle:
 *
 *   idle ─connect→ connecting ─start→ playing ⇄ paused
 *   playing | paused ─wait→ waiting ─start→ playing
 *   connecting | playing | paused | waiting ─finish→ idle
 *   connecting | playing | paused | waiting ─stop→ stopping ─stopped→ idle
 *
 * `start` from playing or paused advances to the next track. `waiting` keeps
 * the connection between tracks while requests are still in flight. Pausing a
 * paused player and resuming a playing one are accepted no-ops.
 *
 * @throws InvalidPlaybackTransitionError for any other combination.
 */
export function transition<T>(state: PlaybackState<T>, event: PlaybackEvent<T>): PlaybackState<T> {
  const next = apply(state, event);
  if (next === undefined) throw new InvalidPlaybackTransitionError(state.status, event.type);
  return next;
}

export function canTransition<T>(state: PlaybackState<T>, event: PlaybackEvent<T>): boolean {
  return apply(state, event) !== undefined;
}

/** Whether the player holds playback resources (from connecting until stopped). */
export function isActive(state: PlaybackState<unknown>): boolean {
  return state.status !== 'idle';
}

function apply<T>(state: PlaybackState<T>, event: PlaybackEvent<T>): PlaybackState<T> | undefined {
  switch (event.type) {
    case 'connect':
      return state.status === 'idle' ? { status: 'connecting' } : undefined;
    case 'start':
      return isRunning(state) ? { status: 'playing', current: event.track } : undefined;
    case 'pause':
      return state.status === 'playing' || state.status === 'paused'
        ? { status: 'paused', current: state.current }
        : undefined;
    case 'resume':
      return state.status === 'playing' || state.status === 'paused'
        ? { status: 'playing', current: state.current }
        : undefined;
    case 'wait':
      return state.status === 'playing' || state.status === 'paused'
        ? { status: 'waiting' }
        : undefined;
    case 'finish':
      return isRunning(state) ? IDLE : undefined;
    case 'stop':
      return isRunning(state) ? { status: 'stopping' } : undefined;
    case 'stopped':
      return state.status === 'stopping' ? IDLE : undefined;
  }
}

function isRunning(state: PlaybackState<unknown>): boolean {
  return (
    state.status === 'connecting' ||
    state.status === 'playing' ||
    state.status === 'paused' ||
    state.status === 'waiting'
  );
}
