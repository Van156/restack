import type { Clock } from "../context";

export type RateLimitRule = { limit: number; windowMs: number };

/** Fixed-window attempt counter keyed by string. */
export type RateLimiter = {
  /** Counts one attempt for `key`; false when the window's `limit` is already used up. */
  hit(key: string, rule: RateLimitRule): boolean;
  reset(): void;
};

/** In-memory limiter on the injected clock; per process, so it bounds one server instance. */
export function createRateLimiter(clock: Clock): RateLimiter {
  const windows = new Map<string, { startedAt: number; count: number; windowMs: number }>();
  return {
    hit(key, { limit, windowMs }) {
      const now = clock.now().getTime();
      for (const [other, entry] of windows) {
        if (now - entry.startedAt >= entry.windowMs) {
          windows.delete(other);
        }
      }
      const entry = windows.get(key) ?? { startedAt: now, count: 0, windowMs };
      windows.set(key, entry);
      if (entry.count >= limit) {
        return false;
      }
      entry.count += 1;
      return true;
    },
    reset: () => windows.clear(),
  };
}
