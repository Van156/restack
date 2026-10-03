import { describe, expect, test } from "bun:test";

import { offlineSaleOf, paymentsBlockedReason } from "./offline-sale";

const record = (over: Record<string, unknown>) => ({
  idempotencyKey: "k",
  kind: "payment",
  status: "pending",
  deviceRecordedAt: "2026-10-03T18:00:00.000Z",
  payload: { tableSessionId: "s1", tender: "cash", amount: 10_000 },
  ...over,
});

describe("offlineSaleOf", () => {
  test("a session with no queued records has no offline sale", () => {
    expect(offlineSaleOf([], "s1")).toEqual({
      queuedPayments: 0,
      settleQueued: false,
      documentQueued: false,
      saleTime: null,
    });
  });

  test("counts the payments waiting for the session and takes the latest as the sale time", () => {
    const sale = offlineSaleOf(
      [
        record({ idempotencyKey: "a", deviceRecordedAt: "2026-10-03T18:00:00.000Z" }),
        record({ idempotencyKey: "b", deviceRecordedAt: "2026-10-03T18:20:00.000Z" }),
        record({ idempotencyKey: "c", payload: { tableSessionId: "other" } }),
        record({ idempotencyKey: "d", status: "synced" }),
        record({ idempotencyKey: "e", status: "rejected" }),
      ],
      "s1",
    );
    expect(sale.queuedPayments).toBe(2);
    expect(sale.saleTime).toBe("2026-10-03T18:20:00.000Z");
  });

  test("knows when the closing payment and the document request are waiting", () => {
    const sale = offlineSaleOf(
      [
        record({ payload: { tableSessionId: "s1", settle: true } }),
        record({
          idempotencyKey: "d",
          kind: "document_request",
          payload: { tableSessionId: "s1" },
        }),
      ],
      "s1",
    );
    expect(sale.settleQueued).toBe(true);
    expect(sale.documentQueued).toBe(true);
  });

  test("a rejected document request no longer counts as queued", () => {
    const sale = offlineSaleOf(
      [record({ kind: "document_request", status: "rejected", payload: { tableSessionId: "s1" } })],
      "s1",
    );
    expect(sale.documentQueued).toBe(false);
  });
});

describe("paymentsBlockedReason", () => {
  test("from 48 hours offline contingency sales stop, and orders and the kitchen go on", () => {
    const reason = paymentsBlockedReason({ online: false, contingencyBlocked: true });
    expect(reason).toContain("48 horas");
    expect(reason).toContain("cocina");
  });

  test("nothing blocks a Cashier who is online or offline for less than 48 hours", () => {
    expect(paymentsBlockedReason({ online: true, contingencyBlocked: false })).toBeNull();
    expect(paymentsBlockedReason({ online: false, contingencyBlocked: false })).toBeNull();
  });
});
