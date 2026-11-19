import { describe, expect, it } from 'vitest';

import { InvalidPlaybackTransitionError } from '../../../../src/domain/music/errors.ts';
import {
  canTransition,
  IDLE,
  isActive,
  transition,
} from '../../../../src/domain/music/PlaybackState.ts';
import type { PlaybackEvent, PlaybackState } from '../../../../src/domain/music/PlaybackState.ts';

const CONNECTING: PlaybackState<string> = { status: 'connecting' };
const PLAYING: PlaybackState<string> = { current: 'a', status: 'playing' };
const PAUSED: PlaybackState<string> = { current: 'a', status: 'paused' };
const WAITING: PlaybackState<string> = { status: 'waiting' };
const STOPPING: PlaybackState<string> = { status: 'stopping' };

const ALL_STATES = [IDLE, CONNECTING, PLAYING, PAUSED, WAITING, STOPPING] as const;
const ALL_EVENTS: PlaybackEvent<string>[] = [
  { type: 'connect' },
  { track: 'b', type: 'start' },
  { type: 'pause' },
  { type: 'resume' },
  { type: 'wait' },
  { type: 'finish' },
  { type: 'stop' },
  { type: 'stopped' },
];

describe('playback state transitions', () => {
  it.each([
    [IDLE, { type: 'connect' }, CONNECTING],
    [CONNECTING, { track: 'a', type: 'start' }, PLAYING],
    [PLAYING, { track: 'b', type: 'start' }, { current: 'b', status: 'playing' }],
    [PAUSED, { track: 'b', type: 'start' }, { current: 'b', status: 'playing' }],
    [PLAYING, { type: 'pause' }, PAUSED],
    [PAUSED, { type: 'pause' }, PAUSED],
    [PAUSED, { type: 'resume' }, PLAYING],
    [PLAYING, { type: 'resume' }, PLAYING],
    [PLAYING, { type: 'wait' }, WAITING],
    [PAUSED, { type: 'wait' }, WAITING],
    [WAITING, { track: 'b', type: 'start' }, { current: 'b', status: 'playing' }],
    [WAITING, { type: 'finish' }, IDLE],
    [WAITING, { type: 'stop' }, STOPPING],
    [CONNECTING, { type: 'finish' }, IDLE],
    [PLAYING, { type: 'finish' }, IDLE],
    [PAUSED, { type: 'finish' }, IDLE],
    [CONNECTING, { type: 'stop' }, STOPPING],
    [PLAYING, { type: 'stop' }, STOPPING],
    [PAUSED, { type: 'stop' }, STOPPING],
    [STOPPING, { type: 'stopped' }, IDLE],
  ] satisfies [PlaybackState<string>, PlaybackEvent<string>, PlaybackState<string>][])(
    '%o + %o → %o',
    (state, event, expected) => {
      expect(canTransition(state, event)).toBe(true);
      expect(transition(state, event)).toEqual(expected);
    },
  );

  it.each([
    [IDLE, 'start'],
    [IDLE, 'pause'],
    [IDLE, 'resume'],
    [IDLE, 'wait'],
    [IDLE, 'finish'],
    [IDLE, 'stop'],
    [IDLE, 'stopped'],
    [CONNECTING, 'connect'],
    [CONNECTING, 'pause'],
    [CONNECTING, 'resume'],
    [CONNECTING, 'wait'],
    [CONNECTING, 'stopped'],
    [PLAYING, 'connect'],
    [PLAYING, 'stopped'],
    [PAUSED, 'connect'],
    [PAUSED, 'stopped'],
    [WAITING, 'connect'],
    [WAITING, 'pause'],
    [WAITING, 'resume'],
    [WAITING, 'wait'],
    [WAITING, 'stopped'],
    [STOPPING, 'connect'],
    [STOPPING, 'start'],
    [STOPPING, 'pause'],
    [STOPPING, 'resume'],
    [STOPPING, 'wait'],
    [STOPPING, 'finish'],
    [STOPPING, 'stop'],
  ] as const)('rejects %o + %s', (state, type) => {
    const event = ALL_EVENTS.find((candidate) => candidate.type === type);
    if (event === undefined) throw new Error(`unknown event ${type}`);

    expect(canTransition(state, event)).toBe(false);
    expect(() => transition(state, event)).toThrow(InvalidPlaybackTransitionError);
  });

  it('covers every state and event combination', () => {
    const accepted = ALL_STATES.flatMap((state) =>
      ALL_EVENTS.filter((event) => canTransition(state, event)).map(() => state),
    );

    expect(accepted).toHaveLength(20);
  });

  it('reports the rejected transition', () => {
    const error = (() => {
      try {
        transition(STOPPING, { type: 'pause' });
      } catch (caught) {
        return caught;
      }
      return;
    })();

    expect(error).toBeInstanceOf(InvalidPlaybackTransitionError);
    expect(error).toMatchObject({ event: 'pause', from: 'stopping' });
  });

  it('does not mutate the previous state', () => {
    const before = { current: 'a', status: 'playing' } as const;
    transition<string>(before, { type: 'pause' });

    expect(before).toEqual({ current: 'a', status: 'playing' });
  });

  it('treats every non-idle state as active', () => {
    expect(ALL_STATES.map((state) => isActive(state))).toEqual([
      false,
      true,
      true,
      true,
      true,
      true,
    ]);
  });
});
