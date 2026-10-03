import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { useRuntime } from "@/shared/hooks/use-runtime";

import { activeActing, toActing, type Acting, type SwitchInResult } from "../lib/acting-member";

type ActingContext = {
  stored: Acting | null;
  switchIn: (result: SwitchInResult) => void;
  switchOut: () => void;
};

const Context = createContext<ActingContext | null>(null);

/** Keeps the acting member in memory only: a reload or a closed tab switches everyone out. */
export function ActingMemberProvider({ children }: { children: ReactNode }) {
  const { timer, clock } = useRuntime();
  const [stored, setStored] = useState<Acting | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!stored) {
      return;
    }
    const remaining = Math.max(0, stored.expiresAt.getTime() - clock.now().getTime());
    return timer.setTimeout(() => setTick((tick) => tick + 1), remaining);
  }, [stored, timer, clock]);

  const value = useMemo<ActingContext>(
    () => ({
      stored,
      switchIn: (result) => setStored(toActing(result)),
      switchOut: () => setStored(null),
    }),
    [stored],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

/** Who is acting at `locationId` right now, with the token to pass on order calls. */
export function useActingMember(locationId: string) {
  const context = useContext(Context);
  const { clock } = useRuntime();
  if (!context) {
    throw new Error("useActingMember needs an ActingMemberProvider.");
  }
  const acting = activeActing(context.stored, clock.now(), locationId);
  return {
    acting,
    actingToken: acting?.token,
    expired: context.stored !== null && acting === null && context.stored.locationId === locationId,
    switchIn: context.switchIn,
    switchOut: context.switchOut,
  };
}
