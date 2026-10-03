import { describe, expect, test } from "bun:test";

import { MAX_CACHED_BILLS, cashierCacheKey, createCashierCache } from "./cashier-cache";
import type { CheckoutBill } from "./checkout-bill";

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    data,
  };
}

const bill = (id: string): CheckoutBill => ({
  tableSessionId: id,
  locationId: "l1",
  status: "open",
  lines: [],
  discountTotal: 0,
  total: 1_000,
  tip: 0,
  suggestedTip: { percent: 10, amount: 100 },
  balanceDue: 1_000,
  taxByClass: { impoconsumo: { base: 0, tax: 0 }, iva19: { base: 0, tax: 0 } },
  payments: [],
  settledAt: null,
});

describe("createCashierCache", () => {
  test("keeps the open sessions, the tables and each Bill as plain JSON", () => {
    const storage = memoryStorage();
    const cache = createCashierCache(storage, "k");
    cache.writeSessions([
      { id: "s1", tableId: "t1", status: "open", openedAt: "2026-10-03T19:00:00Z" },
    ]);
    cache.writeTables([{ id: "t1", name: "1", areaName: "Salón" }]);
    cache.writeBill("s1", bill("s1"));

    const again = createCashierCache(storage, "k");
    expect(again.readSessions()).toHaveLength(1);
    expect(again.readTables()).toEqual([{ id: "t1", name: "1", areaName: "Salón" }]);
    expect(again.readBill("s1")?.total).toBe(1_000);
    expect(again.readBill("other")).toBeUndefined();
  });

  test("keeps only the latest Bills", () => {
    const cache = createCashierCache(memoryStorage(), "k");
    for (let index = 0; index < MAX_CACHED_BILLS + 3; index += 1) {
      cache.writeBill(`s${index}`, bill(`s${index}`));
    }
    expect(cache.readBill("s0")).toBeUndefined();
    expect(cache.readBill(`s${MAX_CACHED_BILLS + 2}`)).toBeDefined();
  });

  test("reads nothing from corrupt or unavailable storage and never throws on write", () => {
    expect(createCashierCache(memoryStorage({ k: "{nope" }), "k").readSessions()).toBeUndefined();
    const full = {
      getItem: () => null,
      setItem: () => {
        throw new Error("quota");
      },
    };
    expect(() => createCashierCache(full, "k").writeTables([])).not.toThrow();
  });

  test("is scoped per organization and Location", () => {
    expect(cashierCacheKey("o1", "l1")).toBe("restack:cashier-cache:o1:l1");
  });
});
