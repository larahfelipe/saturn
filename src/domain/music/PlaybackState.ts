import { InvalidPlaybackTransitionError } from './errors.ts';

export type PlaybackEvent<T> =
  | { readonly track: T; readonly type: 'start' }
  | { readonly type: 'connect' }
  | { readonly type: 'finish' }
  | { readonly type: 'pause' }
  | { readonly type: 'resume' }
  | { readonly type: 'stop' }
  | { readonly type: 'stopped' }
  | { readonly type: 'wait' };

export type PlaybackState<T> =
  | { readonly current: T; readonly status: 'paused' }
  | { readonly current: T; readonly status: 'playing' }
  | { readonly status: 'connecting' }
  | { readonly status: 'idle' }
  | { readonly status: 'stopping' }
  | { readonly status: 'waiting' };

export type PlaybackStatus = PlaybackState<unknown>['status'];

export const IDLE: PlaybackState<never> = Object.freeze({ status: 'idle' });

export function canTransition<T>(state: PlaybackState<T>, event: PlaybackEvent<T>): boolean {
  return apply(state, event) !== undefined;
}

export function isActive(state: PlaybackState<unknown>): boolean {
  return state.status !== 'idle';
}

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

function apply<T>(state: PlaybackState<T>, event: PlaybackEvent<T>): PlaybackState<T> | undefined {
  switch (event.type) {
    case 'connect': {
      return state.status === 'idle' ? { status: 'connecting' } : undefined;
    }
    case 'finish': {
      return isRunning(state) ? IDLE : undefined;
    }
    case 'pause': {
      return state.status === 'playing' || state.status === 'paused'
        ? { current: state.current, status: 'paused' }
        : undefined;
    }
    case 'resume': {
      return state.status === 'playing' || state.status === 'paused'
        ? { current: state.current, status: 'playing' }
        : undefined;
    }
    case 'start': {
      return isRunning(state) ? { current: event.track, status: 'playing' } : undefined;
    }
    case 'stop': {
      return isRunning(state) ? { status: 'stopping' } : undefined;
    }
    case 'stopped': {
      return state.status === 'stopping' ? IDLE : undefined;
    }
    case 'wait': {
      return state.status === 'playing' || state.status === 'paused'
        ? { status: 'waiting' }
        : undefined;
    }
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
