import { setImmediate as nextMacrotask } from 'node:timers/promises';

import { describe, expect, it } from 'vitest';

import { TrackQueue } from '../../../../src/domain/music/TrackQueue.ts';

describe(TrackQueue, () => {
  it('dequeues in FIFO order', () => {
    const queue = new TrackQueue<string>();
    queue.enqueue('a');
    queue.enqueue('b');
    queue.enqueue('c');

    expect([queue.dequeue(), queue.dequeue(), queue.dequeue()]).toEqual(['a', 'b', 'c']);
  });

  it('returns 1-based positions among waiting items', () => {
    const queue = new TrackQueue<string>();

    expect(queue.enqueue('a')).toBe(1);
    expect(queue.enqueue('b')).toBe(2);
    queue.dequeue();
    expect(queue.enqueue('c')).toBe(2);
  });

  it('tracks size and emptiness', () => {
    const queue = new TrackQueue<string>();
    expect(queue.size).toBe(0);
    expect(queue.isEmpty).toBe(true);

    queue.enqueue('a');
    queue.enqueue('b');
    expect(queue.size).toBe(2);
    expect(queue.isEmpty).toBe(false);

    queue.dequeue();
    expect(queue.size).toBe(1);
  });

  it('peeks without removing', () => {
    const queue = new TrackQueue<string>();
    queue.enqueue('a');

    expect(queue.peek()).toBe('a');
    expect(queue.size).toBe(1);
  });

  it('clears and returns removed items in order', () => {
    const queue = new TrackQueue<string>();
    queue.enqueue('a');
    queue.enqueue('b');

    expect(queue.clear()).toEqual(['a', 'b']);
    expect(queue.isEmpty).toBe(true);
    expect(queue.enqueue('c')).toBe(1);
  });

  it('returns undefined from dequeue and peek when empty', () => {
    const queue = new TrackQueue<string>();

    expect(queue.dequeue()).toBeUndefined();
    expect(queue.peek()).toBeUndefined();
    expect(queue.clear()).toEqual([]);
    expect(queue.size).toBe(0);
  });

  it('puts an item at the front with enqueueNext', () => {
    const queue = new TrackQueue<string>();
    queue.enqueue('a');

    expect(queue.enqueueNext('b')).toBe(1);
    expect(queue.snapshot()).toEqual(['b', 'a']);
  });

  it('removes the item at a position', () => {
    const queue = new TrackQueue<string>();
    queue.enqueue('a');
    queue.enqueue('b');
    queue.enqueue('c');

    expect(queue.remove(2)).toBe('b');
    expect(queue.snapshot()).toEqual(['a', 'c']);
  });

  it('moves an item to another position', () => {
    const queue = new TrackQueue<string>();
    for (const item of ['a', 'b', 'c', 'd']) queue.enqueue(item);

    expect(queue.move(4, 2)).toBe('d');
    expect(queue.snapshot()).toEqual(['a', 'd', 'b', 'c']);
    expect(queue.move(1, 4)).toBe('a');
    expect(queue.snapshot()).toEqual(['d', 'b', 'c', 'a']);
    expect(queue.move(2, 2)).toBe('b');
    expect(queue.snapshot()).toEqual(['d', 'b', 'c', 'a']);
  });

  it('drops the items ahead of a position with skipTo', () => {
    const queue = new TrackQueue<string>();
    for (const item of ['a', 'b', 'c']) queue.enqueue(item);

    expect(queue.skipTo(2)).toBe('b');
    expect(queue.snapshot()).toEqual(['b', 'c']);
    expect(queue.skipTo(1)).toBe('b');
    expect(queue.snapshot()).toEqual(['b', 'c']);
  });

  it.each([0, -1, 4, 1.5, NaN])('ignores position %s outside the queue', (position) => {
    const queue = new TrackQueue<string>();
    for (const item of ['a', 'b', 'c']) queue.enqueue(item);

    expect(queue.remove(position)).toBeUndefined();
    expect(queue.move(position, 1)).toBeUndefined();
    expect(queue.move(1, position)).toBeUndefined();
    expect(queue.skipTo(position)).toBeUndefined();
    expect(queue.snapshot()).toEqual(['a', 'b', 'c']);
  });

  it('shuffles the items in the order of their random keys', () => {
    const queue = new TrackQueue<string>();
    for (const item of ['a', 'b', 'c', 'd']) queue.enqueue(item);
    const keys = [0.7, 0.1, 0.9, 0.4];

    queue.shuffle(() => keys.shift() ?? 0);

    expect(queue.snapshot()).toEqual(['b', 'd', 'a', 'c']);
  });

  it('keeps every item when shuffling with the default random source', () => {
    const queue = new TrackQueue<number>();
    for (let item = 0; item < 50; item++) queue.enqueue(item);

    queue.shuffle();

    expect(queue.snapshot().toSorted((a, b) => a - b)).toEqual(
      Array.from({ length: 50 }, (_, item) => item),
    );
  });

  it('does not expose its internal storage', () => {
    const queue = new TrackQueue<string>();
    queue.enqueue('a');

    const snapshot = queue.snapshot() as string[];
    snapshot.push('b');

    expect(queue.size).toBe(1);
  });

  it('assigns unique, contiguous positions to interleaved async producers', async () => {
    const queue = new TrackQueue<string>();
    const producers = 20;
    const perProducer = 50;

    const results = await Promise.all(
      Array.from({ length: producers }, async (_, producer) => {
        const assigned: [string, number][] = [];
        for (let i = 0; i < perProducer; i++) {
          await nextMacrotask();
          const item = `${producer}:${i}`;
          assigned.push([item, queue.enqueue(item)]);
        }
        return assigned;
      }),
    );

    const byPosition = new Map(results.flat().map(([item, position]) => [position, item]));
    const total = producers * perProducer;
    expect(byPosition.size).toBe(total);

    for (let position = 1; position <= total; position++) {
      expect(queue.dequeue()).toBe(byPosition.get(position));
    }
    expect(queue.isEmpty).toBe(true);
  });

  it('keeps instances independent', () => {
    const a = new TrackQueue<string>();
    const b = new TrackQueue<string>();
    a.enqueue('a');

    expect(b.isEmpty).toBe(true);
    b.clear();
    expect(a.size).toBe(1);
  });
});
