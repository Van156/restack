const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;

/** Compact elapsed time for Tickets and Waiter calls: `< 1 min`, `12 min`, `1 h 5 min`. */
export function formatAge(ms: number): string {
  const elapsed = Math.max(0, ms);
  if (elapsed < MINUTE_MS) {
    return "< 1 min";
  }
  const hours = Math.floor(elapsed / HOUR_MS);
  const minutes = Math.floor((elapsed % HOUR_MS) / MINUTE_MS);
  if (hours === 0) {
    return `${minutes} min`;
  }
  return minutes === 0 ? `${hours} h` : `${hours} h ${minutes} min`;
}
