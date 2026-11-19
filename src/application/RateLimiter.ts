export interface RateLimiterOptions {
  readonly limit: number;
  readonly now?: () => number;
  readonly windowMs: number;
}

export type RateLimitResult =
  { readonly allowed: false; readonly retryAfterMs: number } | { readonly allowed: true };

export class RateLimiter {
  get size(): number {
    return this.#actions.size;
  }

  readonly #actions = new Map<string, number[]>();
  #lastSweep: number;
  readonly #limit: number;
  readonly #now: () => number;
  readonly #windowMs: number;

  constructor(options: RateLimiterOptions) {
    this.#limit = options.limit;
    this.#windowMs = options.windowMs;
    this.#now = options.now ?? Date.now;
    this.#lastSweep = this.#now();
  }

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

  #sweep(now: number): void {
    if (now - this.#lastSweep < this.#windowMs) return;
    this.#lastSweep = now;
    for (const [key, times] of this.#actions) {
      const newest = times.at(-1);
      if (newest === undefined || now - newest >= this.#windowMs) this.#actions.delete(key);
    }
  }
}
