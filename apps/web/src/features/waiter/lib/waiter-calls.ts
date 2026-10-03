export type WaiterCallInput = {
  id: string;
  tableName: string;
  reason: "need_something" | "cutlery_napkins" | "pay";
  status: "open" | "on_the_way" | "attended";
  createdAt: Date;
};

export type CallRow = {
  id: string;
  tableName: string;
  reasonLabel: string;
  statusLabel: string;
  ageMs: number;
  canAcknowledge: boolean;
};

const REASON_LABEL: Record<WaiterCallInput["reason"], string> = {
  need_something: "Necesita algo",
  cutlery_napkins: "Más cubiertos o servilletas",
  pay: "Quiere pagar",
};

/** Calls still to attend, oldest first, with copy and age by the injected `now`. */
export function callRows(calls: readonly WaiterCallInput[], now: Date): CallRow[] {
  return calls
    .filter((call) => call.status !== "attended")
    .toSorted((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .map((call) => ({
      id: call.id,
      tableName: call.tableName,
      reasonLabel: REASON_LABEL[call.reason],
      statusLabel: call.status === "open" ? "Esperando" : "En camino",
      ageMs: Math.max(0, now.getTime() - call.createdAt.getTime()),
      canAcknowledge: call.status === "open",
    }));
}

/** Calls nobody has answered with "Voy" yet. */
export function openCallCount(calls: readonly Pick<WaiterCallInput, "status">[]): number {
  return calls.filter((call) => call.status === "open").length;
}
