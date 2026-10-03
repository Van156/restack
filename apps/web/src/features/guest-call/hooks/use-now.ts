import { useEffect, useState } from "react";

import { useRuntime } from "@/shared/hooks/use-runtime";

import { startClockTicks } from "../lib/clock-ticks";

/**
 * The current time from the runtime clock, refreshed every `intervalMs` while `active`; idle pages
 * do not tick. The public guest route has no `RuntimeProvider`, so it gets the default runtime
 * (system clock, browser timer); tests and stories wrap the page in a `RuntimeProvider`.
 */
export function useNow(active: boolean, intervalMs = 1000): Date {
  const { clock, timer } = useRuntime();
  const [now, setNow] = useState(() => clock.now());
  useEffect(() => {
    if (!active) {
      return;
    }
    return startClockTicks({ clock, timer, intervalMs, onTick: setNow });
  }, [active, intervalMs, clock, timer]);
  return now;
}
