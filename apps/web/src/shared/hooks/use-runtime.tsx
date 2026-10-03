import { createContext, useContext, type ReactNode } from "react";

import { systemClock, type Clock } from "../lib/clock";
import { browserTimer, type Timer } from "../lib/polling";

/** The time sources views use; replaced in tests and stories to control time. */
export type Runtime = { clock: Clock; timer: Timer };

const defaultRuntime: Runtime = { clock: systemClock, timer: browserTimer };
const RuntimeContext = createContext<Runtime>(defaultRuntime);

export function RuntimeProvider({ runtime, children }: { runtime: Runtime; children: ReactNode }) {
  return <RuntimeContext.Provider value={runtime}>{children}</RuntimeContext.Provider>;
}

export function useRuntime(): Runtime {
  return useContext(RuntimeContext);
}
