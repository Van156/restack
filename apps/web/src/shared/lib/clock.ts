/** Source of the current time, injected so views and tests never read the wall clock directly. */
export type Clock = { now(): Date };

export const systemClock: Clock = { now: () => new Date() };
