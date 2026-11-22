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

  enqueueNext(item: T): number {
    this.#items.unshift(item);
    return 1;
  }

  move(from: number, to: number): T | undefined {
    if (!this.#has(from) || !this.#has(to)) return undefined;
    const moved = this.#items.splice(from - 1, 1);
    this.#items.splice(to - 1, 0, ...moved);
    return moved[0];
  }

  peek(): T | undefined {
    return this.#items[0];
  }

  remove(position: number): T | undefined {
    if (!this.#has(position)) return undefined;
    return this.#items.splice(position - 1, 1)[0];
  }

  /** Sorts by a random key per item, so every order is equally likely. */
  shuffle(random: () => number = Math.random): void {
    const shuffled = this.#items
      .map((item) => ({ item, key: random() }))
      .toSorted((a, b) => a.key - b.key)
      .map(({ item }) => item);
    this.#items.splice(0, this.#items.length, ...shuffled);
  }

  skipTo(position: number): T | undefined {
    if (!this.#has(position)) return undefined;
    this.#items.splice(0, position - 1);
    return this.#items[0];
  }

  snapshot(): readonly T[] {
    return [...this.#items];
  }

  #has(position: number): boolean {
    return Number.isSafeInteger(position) && position >= 1 && position <= this.#items.length;
  }
}
