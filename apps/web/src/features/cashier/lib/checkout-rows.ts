export type OpenSession = {
  id: string;
  tableId: string;
  status: "open" | "bill_requested" | "settled";
  /** ISO time the session was opened. */
  openedAt: string;
};

export type CheckoutTable = { id: string; name: string; areaName: string };

export type CheckoutRow = {
  sessionId: string;
  tableName: string;
  areaName: string | null;
  billRequested: boolean;
};

/** Bills to charge: Tables that asked for the bill first, then the longest open. */
export function buildCheckoutRows(
  sessions: readonly OpenSession[],
  tables: readonly CheckoutTable[],
): CheckoutRow[] {
  const byId = new Map(tables.map((table) => [table.id, table]));
  return sessions
    .filter((session) => session.status !== "settled")
    .toSorted((a, b) => {
      const requested =
        Number(b.status === "bill_requested") - Number(a.status === "bill_requested");
      return requested !== 0 ? requested : a.openedAt.localeCompare(b.openedAt);
    })
    .map((session) => {
      const table = byId.get(session.tableId);
      return {
        sessionId: session.id,
        tableName: table?.name ?? "Mesa",
        areaName: table?.areaName ?? null,
        billRequested: session.status === "bill_requested",
      };
    });
}
