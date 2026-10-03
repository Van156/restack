import type { Clock } from "./context";

/** Production clock. Tests pass `{ now: () => fixedDate }` instead. */
export const systemClock: Clock = { now: () => new Date() };
