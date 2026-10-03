import type { SessionRef } from "./order-action";

export type FloorArea = { id: string; name: string };
export type FloorTable = { id: string; areaId: string; name: string; seats: number };
export type FloorSession = {
  ref: SessionRef;
  tableId: string;
  status: "open" | "bill_requested" | "settled";
  hasReadyTicket: boolean;
};
export type FloorCall = {
  id: string;
  tableSessionId: string;
  status: "open" | "on_the_way" | "attended";
  createdAt: Date;
};

export type FloorTile = {
  tableId: string;
  name: string;
  seats: number;
  state: "free" | "occupied" | "bill_requested";
  hasReadyTicket: boolean;
  waiterCallAgeMs: number | null;
  session: SessionRef | null;
};

export type FloorPlanArea = { id: string; name: string; tables: FloorTile[] };

/** Age of the oldest call still waiting for a Waiter ("Voy" not pressed yet), or null. */
function oldestOpenCallAge(calls: readonly FloorCall[], now: Date): number | null {
  const open = calls.filter((call) => call.status === "open");
  if (open.length === 0) {
    return null;
  }
  const oldest = Math.min(...open.map((call) => call.createdAt.getTime()));
  return Math.max(0, now.getTime() - oldest);
}

/** Areas with one tile per Table, merging in the open sessions and Waiter calls of the Location. */
export function buildFloorPlan(input: {
  areas: readonly FloorArea[];
  tables: readonly FloorTable[];
  sessions: readonly FloorSession[];
  calls: readonly FloorCall[];
  now: Date;
}): FloorPlanArea[] {
  const sessionByTable = new Map(
    input.sessions
      .filter((session) => session.status !== "settled")
      .map((session) => [session.tableId, session]),
  );
  return input.areas.map((area) => ({
    id: area.id,
    name: area.name,
    tables: input.tables
      .filter((table) => table.areaId === area.id)
      .map((table): FloorTile => {
        const session = sessionByTable.get(table.id);
        return {
          tableId: table.id,
          name: table.name,
          seats: table.seats,
          state: session ? (session.status === "open" ? "occupied" : "bill_requested") : "free",
          hasReadyTicket: session?.hasReadyTicket ?? false,
          waiterCallAgeMs: session
            ? oldestOpenCallAge(
                input.calls.filter(
                  (call) =>
                    "sessionId" in session.ref && call.tableSessionId === session.ref.sessionId,
                ),
                input.now,
              )
            : null,
          session: session?.ref ?? null,
        };
      }),
  }));
}
