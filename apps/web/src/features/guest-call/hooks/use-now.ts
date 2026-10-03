import { useEffect, useState } from "react";

/** The current time, refreshed every `intervalMs` while `active`; idle pages do not tick. */
export function useNow(active: boolean, intervalMs = 1000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!active) {
      return;
    }
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [active, intervalMs]);
  return now;
}
