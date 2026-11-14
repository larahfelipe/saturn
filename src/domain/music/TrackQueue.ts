/**
 * FIFO of tracks waiting to be played. Positions are 1-based and count only
 * waiting items, so the next track to play is at position 1.
 */
export class TrackQueue<T> {
  readonly #items: T[] = [];

  get size(): number {
    return this.#items.length;
  }

  get isEmpty(): boolean {
    return this.#items.length === 0;
  }

  /** Appends an item and returns the position it was assigned. */
  enqueue(item: T): number {
    return this.#items.push(item);
  }

  /** Removes and returns the next item, or `undefined` when empty. */
  dequeue(): T | undefined {
    return this.#items.shift();
  }

  /** Returns the next item without removing it, or `undefined` when empty. */
  peek(): T | undefined {
    return this.#items[0];
  }

  /** Removes every item and returns them in queue order. */
  clear(): T[] {
    return this.#items.splice(0);
  }

  snapshot(): readonly T[] {
    return [...this.#items];
  }
}
