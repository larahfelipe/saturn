import { beforeEach, describe, expect, it } from 'vitest';

import { RateLimiter } from '../../../src/application/RateLimiter.ts';

describe('RateLimiter', () => {
  let now: number;
  let limiter: RateLimiter;

  beforeEach(() => {
    now = 1_000_000;
    limiter = new RateLimiter({ limit: 2, windowMs: 10_000, now: () => now });
  });

  it('allows up to the limit within the window', () => {
    expect(limiter.tryAcquire('alice')).toEqual({ allowed: true });
    now += 3_000;
    expect(limiter.tryAcquire('alice')).toEqual({ allowed: true });
    now += 1_000;

    expect(limiter.tryAcquire('alice')).toEqual({ allowed: false, retryAfterMs: 6_000 });
  });

  it('does not count refused attempts', () => {
    limiter.tryAcquire('alice');
    limiter.tryAcquire('alice');
    limiter.tryAcquire('alice');

    now += 10_000;

    expect(limiter.tryAcquire('alice')).toEqual({ allowed: true });
    expect(limiter.tryAcquire('alice')).toEqual({ allowed: true });
  });

  it('frees capacity as actions leave the window', () => {
    limiter.tryAcquire('alice');
    now += 5_000;
    limiter.tryAcquire('alice');

    now += 4_999;
    expect(limiter.tryAcquire('alice')).toMatchObject({ allowed: false, retryAfterMs: 1 });
    now += 1;
    expect(limiter.tryAcquire('alice')).toEqual({ allowed: true });
    expect(limiter.tryAcquire('alice')).toMatchObject({ allowed: false, retryAfterMs: 5_000 });
  });

  it('limits each key separately', () => {
    limiter.tryAcquire('alice');
    limiter.tryAcquire('alice');

    expect(limiter.tryAcquire('bob')).toEqual({ allowed: true });
  });

  it('forgets keys without recent actions', () => {
    limiter.tryAcquire('alice');
    limiter.tryAcquire('bob');
    expect(limiter.size).toBe(2);

    now += 10_000;
    limiter.tryAcquire('carol');

    expect(limiter.size).toBe(1);
  });
});
