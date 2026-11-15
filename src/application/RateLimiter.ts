export interface RateLimiterOptions {
  /** Actions allowed per key within `windowMs`. */
  readonly limit: number;
  readonly windowMs: number;
  readonly now?: () => number;
}

export type RateLimitResult =
  { readonly allowed: true } | { readonly allowed: false; readonly retryAfterMs: number };

/** Sliding-window limit on actions per key, such as requests per user. */
export class RateLimiter {
  readonly #limit: number;
  readonly #windowMs: number;
  readonly #now: () => number;
  /** Times of the actions inside the window, oldest first. */
  readonly #actions = new Map<string, number[]>();
  #lastSweep: number;

  constructor(options: RateLimiterOptions) {
    this.#limit = options.limit;
    this.#windowMs = options.windowMs;
    this.#now = options.now ?? Date.now;
    this.#lastSweep = this.#now();
  }

  /** Number of keys with actions still inside the window, at the last sweep. */
  get size(): number {
    return this.#actions.size;
  }

  /** Records an action for `key` if the limit allows it. */
  tryAcquire(key: string): RateLimitResult {
    const now = this.#now();
    this.#sweep(now);
    const recent = (this.#actions.get(key) ?? []).filter((time) => now - time < this.#windowMs);
    const [oldest] = recent;
    if (oldest !== undefined && recent.length >= this.#limit) {
      this.#actions.set(key, recent);
      return { allowed: false, retryAfterMs: oldest + this.#windowMs - now };
    }
    recent.push(now);
    this.#actions.set(key, recent);
    return { allowed: true };
  }

  /** Forgets keys whose actions all left the window, at most once per window. */
  #sweep(now: number): void {
    if (now - this.#lastSweep < this.#windowMs) return;
    this.#lastSweep = now;
    for (const [key, times] of this.#actions) {
      const newest = times.at(-1);
      if (newest === undefined || now - newest >= this.#windowMs) this.#actions.delete(key);
    }
  }
}
