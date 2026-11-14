import { describe, expect, it } from 'vitest';

import { InvalidPlaybackTransitionError } from '../../../src/domain/music/errors.ts';
import {
  canTransition,
  IDLE,
  isActive,
  transition,
  type PlaybackEvent,
  type PlaybackState,
} from '../../../src/domain/music/PlaybackState.ts';

const connecting: PlaybackState<string> = { status: 'connecting' };
const playing: PlaybackState<string> = { status: 'playing', current: 'a' };
const paused: PlaybackState<string> = { status: 'paused', current: 'a' };
const stopping: PlaybackState<string> = { status: 'stopping' };

const allStates = [IDLE, connecting, playing, paused, stopping] as const;
const allEvents: PlaybackEvent<string>[] = [
  { type: 'connect' },
  { type: 'start', track: 'b' },
  { type: 'pause' },
  { type: 'resume' },
  { type: 'finish' },
  { type: 'stop' },
  { type: 'stopped' },
];

describe('playback state transitions', () => {
  it.each([
    [IDLE, { type: 'connect' }, connecting],
    [connecting, { type: 'start', track: 'a' }, playing],
    [playing, { type: 'start', track: 'b' }, { status: 'playing', current: 'b' }],
    [paused, { type: 'start', track: 'b' }, { status: 'playing', current: 'b' }],
    [playing, { type: 'pause' }, paused],
    [paused, { type: 'pause' }, paused],
    [paused, { type: 'resume' }, playing],
    [playing, { type: 'resume' }, playing],
    [connecting, { type: 'finish' }, IDLE],
    [playing, { type: 'finish' }, IDLE],
    [paused, { type: 'finish' }, IDLE],
    [connecting, { type: 'stop' }, stopping],
    [playing, { type: 'stop' }, stopping],
    [paused, { type: 'stop' }, stopping],
    [stopping, { type: 'stopped' }, IDLE],
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
    [IDLE, 'finish'],
    [IDLE, 'stop'],
    [IDLE, 'stopped'],
    [connecting, 'connect'],
    [connecting, 'pause'],
    [connecting, 'resume'],
    [connecting, 'stopped'],
    [playing, 'connect'],
    [playing, 'stopped'],
    [paused, 'connect'],
    [paused, 'stopped'],
    [stopping, 'connect'],
    [stopping, 'start'],
    [stopping, 'pause'],
    [stopping, 'resume'],
    [stopping, 'finish'],
    [stopping, 'stop'],
  ] as const)('rejects %o + %s', (state, type) => {
    const event = allEvents.find((candidate) => candidate.type === type);
    if (event === undefined) throw new Error(`unknown event ${type}`);

    expect(canTransition(state, event)).toBe(false);
    expect(() => transition(state, event)).toThrow(InvalidPlaybackTransitionError);
  });

  it('covers every state and event combination', () => {
    const accepted = allStates.flatMap((state) =>
      allEvents.filter((event) => canTransition(state, event)).map(() => state),
    );

    expect(accepted).toHaveLength(15);
  });

  it('reports the rejected transition', () => {
    const error = (() => {
      try {
        transition(stopping, { type: 'pause' });
      } catch (caught) {
        return caught;
      }
      return undefined;
    })();

    expect(error).toBeInstanceOf(InvalidPlaybackTransitionError);
    expect(error).toMatchObject({ from: 'stopping', event: 'pause' });
  });

  it('does not mutate the previous state', () => {
    const before = { status: 'playing', current: 'a' } as const;
    transition<string>(before, { type: 'pause' });

    expect(before).toEqual({ status: 'playing', current: 'a' });
  });

  it('treats every non-idle state as active', () => {
    expect(allStates.map(isActive)).toEqual([false, true, true, true, true]);
  });
});
