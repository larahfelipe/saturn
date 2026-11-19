export class TrackQueue<T> {
  get isEmpty(): boolean {
    return this.#items.length === 0;
  }

  get size(): number {
    return this.#items.length;
  }

  readonly #items: T[] = [];

  clear(): T[] {
    return this.#items.splice(0);
  }

  dequeue(): T | undefined {
    return this.#items.shift();
  }

  enqueue(item: T): number {
    this.#items.push(item);
    return this.#items.length;
  }

  peek(): T | undefined {
    return this.#items[0];
  }

  snapshot(): readonly T[] {
    return [...this.#items];
  }
}
