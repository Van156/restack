import type { CheckoutBill } from "./checkout-bill";
import type { CheckoutTable, OpenSession } from "./checkout-rows";

type Shape = {
  sessions: OpenSession[];
  tables: CheckoutTable[];
  bills: Record<string, CheckoutBill>;
};

export const MAX_CACHED_BILLS = 30;

export function cashierCacheKey(organizationId: string, locationId: string): string {
  return `restack:cashier-cache:${organizationId}:${locationId}`;
}

/**
 * What the Cashier needs to keep charging offline: the open sessions, Table names and the last
 * Bill seen of each session, as plain JSON. No tokens or PINs. See docs/architecture/web-app.md#cashier-pages.
 */
export function createCashierCache(storage: Pick<Storage, "getItem" | "setItem">, key: string) {
  function load(): Partial<Shape> {
    try {
      const parsed: unknown = JSON.parse(storage.getItem(key) ?? "{}");
      return parsed && typeof parsed === "object" ? (parsed as Partial<Shape>) : {};
    } catch {
      return {};
    }
  }
  function save(next: Partial<Shape>) {
    try {
      storage.setItem(key, JSON.stringify(next));
    } catch {
      // A full or unavailable storage only costs the offline copy.
    }
  }
  function writeSlot<K extends "sessions" | "tables">(slot: K, value: Shape[K]) {
    const current = load();
    if (JSON.stringify(current[slot]) !== JSON.stringify(value)) {
      save({ ...current, [slot]: value });
    }
  }
  return {
    readSessions: () => load().sessions,
    writeSessions: (value: OpenSession[]) => writeSlot("sessions", value),
    readTables: () => load().tables,
    writeTables: (value: CheckoutTable[]) => writeSlot("tables", value),
    readBill: (sessionId: string) => load().bills?.[sessionId],
    writeBill(sessionId: string, bill: CheckoutBill) {
      const current = load();
      if (JSON.stringify(current.bills?.[sessionId]) === JSON.stringify(bill)) {
        return;
      }
      const { [sessionId]: _replaced, ...others } = current.bills ?? {};
      const kept = Object.entries({ ...others, [sessionId]: bill }).slice(-MAX_CACHED_BILLS);
      save({ ...current, bills: Object.fromEntries(kept) });
    },
  };
}

export type CashierCache = ReturnType<typeof createCashierCache>;
