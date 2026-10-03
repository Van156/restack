import type { Clock } from "@/shared/lib/clock";
import type { Timer } from "@/shared/lib/polling";

/** Reports the clock now and after every interval until the returned function stops it. */
export function startClockTicks(deps: {
  clock: Clock;
  timer: Timer;
  intervalMs: number;
  onTick: (now: Date) => void;
}): () => void {
  let cancelNext: (() => void) | null = null;
  const tick = () => {
    deps.onTick(deps.clock.now());
    cancelNext = deps.timer.setTimeout(tick, deps.intervalMs);
  };
  tick();
  return () => cancelNext?.();
}
