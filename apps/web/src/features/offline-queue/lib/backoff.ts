export const BACKOFF_BASE_MS = 60 * 1000;
export const BACKOFF_MAX_MS = 60 * 60 * 1000;

/** Wait after the nth failed attempt: 1, 2, 4, 8, 16, 32 minutes, then 60 minutes. */
export function backoffDelayMs(attempts: number): number {
  if (attempts < 1) {
    return 0;
  }
  return Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** Math.min(attempts - 1, 20));
}
