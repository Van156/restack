import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { useRuntime } from "@/shared/hooks/use-runtime";

import { actingToken, activeActing, endedTurn, type Acting } from "../lib/acting-member";

type ActingContext = {
  stored: Acting | null;
  switchIn: (acting: Acting) => void;
  switchOut: () => void;
};

const Context = createContext<ActingContext | null>(null);

/** Keeps the acting member in memory only: a reload or a closed tab switches everyone out. */
export function ActingMemberProvider({ children }: { children: ReactNode }) {
  const { timer, clock } = useRuntime();
  const [stored, setStored] = useState<Acting | null>(null);

  useEffect(() => {
    if (!stored || stored.credential.kind === "ended") {
      return;
    }
    const remaining = Math.max(0, stored.expiresAt.getTime() - clock.now().getTime());
    return timer.setTimeout(
      () => setStored((current) => (current ? endedTurn(current) : current)),
      remaining,
    );
  }, [stored, timer, clock]);

  const value = useMemo<ActingContext>(
    () => ({
      stored,
      switchIn: setStored,
      switchOut: () => setStored(null),
    }),
    [stored],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

/**
 * Who is acting at `locationId` right now. `actingToken` goes on online order calls; a member who
 * entered the PIN offline has none and `signer` signs their queued records instead.
 */
export function useActingMember(locationId: string) {
  const context = useContext(Context);
  const { clock } = useRuntime();
  if (!context) {
    throw new Error("useActingMember needs an ActingMemberProvider.");
  }
  const acting = activeActing(context.stored, clock.now(), locationId);
  return {
    acting,
    actingToken: actingToken(acting),
    signer: acting?.credential.kind === "offline" ? acting.credential.signer : undefined,
    expired: context.stored !== null && acting === null && context.stored.locationId === locationId,
    switchIn: context.switchIn,
    switchOut: context.switchOut,
  };
}
