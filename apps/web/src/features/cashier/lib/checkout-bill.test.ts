import { describe, expect, test } from "bun:test";

import {
  canSettle,
  ledgerProps,
  queuedPaymentsFor,
  toCheckoutBill,
  withQueuedPayments,
  type BillSource,
} from "./checkout-bill";

const source: BillSource = {
  tableSessionId: "s1",
  locationId: "l1",
  status: "open",
  lines: [
    {
      id: "a",
      itemName: "Bandeja paisa",
      quantity: 2,
      note: null,
      unitTotal: 27_000,
      base: 50_000,
      tax: 4_000,
      total: 54_000,
      taxClass: "impoconsumo",
    },
    {
      id: "b",
      itemName: "Cerveza",
      quantity: 1,
      note: "sin hielo",
      unitTotal: 8_000,
      base: 6_723,
      tax: 1_277,
      total: 8_000,
      taxClass: "iva19",
    },
  ],
  discountTotal: 0,
  total: 62_000,
  tip: 6_200,
  suggestedTip: { percent: 10, amount: 6_200 },
  balanceDue: 48_200,
  taxByClass: { impoconsumo: { base: 50_000, tax: 4_000 }, iva19: { base: 6_723, tax: 1_277 } },
  payments: [
    {
      id: "p1",
      tender: "cash",
      amount: 20_000,
      tendered: 20_000,
      change: 0,
      reference: null,
      registeredOffline: false,
      recordedAt: new Date("2026-10-03T20:00:00Z"),
      clientRecordedAt: null,
    },
  ],
  settledAt: null,
};

describe("toCheckoutBill", () => {
  test("keeps the amounts and turns dates into ISO strings for the local copy", () => {
    const bill = toCheckoutBill(source);
    expect(bill.total).toBe(62_000);
    expect(bill.payments[0]).toMatchObject({
      id: "p1",
      saleTime: "2026-10-03T20:00:00.000Z",
      queued: false,
    });
    expect(JSON.parse(JSON.stringify(bill))).toEqual(bill);
  });

  test("a payment recorded offline keeps the device time as its sale time", () => {
    const bill = toCheckoutBill({
      ...source,
      payments: [
        {
          ...source.payments[0]!,
          registeredOffline: true,
          clientRecordedAt: new Date("2026-10-03T18:30:00Z"),
        },
      ],
    });
    expect(bill.payments[0]!.saleTime).toBe("2026-10-03T18:30:00.000Z");
  });
});

describe("ledgerProps", () => {
  test("itemizes tax by class, skipping classes with no tax, and keeps the tip apart", () => {
    const props = ledgerProps(toCheckoutBill(source));
    expect(props.taxes).toEqual([
      { label: "Impoconsumo 8%", amount: 4_000 },
      { label: "IVA 19%", amount: 1_277 },
    ]);
    expect(props.lines[0]).toEqual({
      id: "a",
      quantity: 2,
      name: "Bandeja paisa",
      base: 50_000,
      tax: 4_000,
      total: 54_000,
    });
    expect(props.total).toBe(62_000);
    expect(props.tip).toBe(6_200);
    expect(props.balanceDue).toBe(48_200);
  });

  test("an empty Bill has no tax rows", () => {
    const props = ledgerProps(
      toCheckoutBill({
        ...source,
        lines: [],
        taxByClass: { impoconsumo: { base: 0, tax: 0 }, iva19: { base: 0, tax: 0 } },
      }),
    );
    expect(props.taxes).toEqual([]);
  });
});

const queuedRecord = (over: Record<string, unknown>) => ({
  idempotencyKey: "q1",
  kind: "payment" as const,
  status: "pending" as const,
  deviceRecordedAt: "2026-10-03T21:00:00.000Z",
  payload: { tableSessionId: "s1", tender: "cash", amount: 10_000, tendered: 12_000 },
  ...over,
});

describe("queuedPaymentsFor", () => {
  test("lists the payments waiting in the queue for the session, not synced or refused ones", () => {
    const records = [
      queuedRecord({}),
      queuedRecord({ idempotencyKey: "q2", kind: "takings", status: "failed" }),
      queuedRecord({ idempotencyKey: "q3", status: "synced" }),
      queuedRecord({ idempotencyKey: "q4", status: "rejected" }),
      queuedRecord({ idempotencyKey: "q5", kind: "document_request" }),
      queuedRecord({ idempotencyKey: "q6", payload: { tableSessionId: "other", amount: 5 } }),
    ];
    expect(queuedPaymentsFor(records, { sessionId: "s1" }).map((p) => p.id)).toEqual(["q1", "q2"]);
  });

  test("a session opened offline is matched by its key", () => {
    const records = [
      queuedRecord({ payload: { sessionKey: "k1", tender: "card", amount: 9_000 } }),
    ];
    expect(queuedPaymentsFor(records, { sessionKey: "k1" })).toHaveLength(1);
    expect(queuedPaymentsFor(records, { sessionId: "s1" })).toHaveLength(0);
  });

  test("builds the payment as the ledger shows it, flagged offline, with its change", () => {
    const [payment] = queuedPaymentsFor([queuedRecord({})], { sessionId: "s1" });
    expect(payment).toEqual({
      id: "q1",
      tender: "cash",
      amount: 10_000,
      tendered: 12_000,
      change: 2_000,
      reference: null,
      registeredOffline: true,
      saleTime: "2026-10-03T21:00:00.000Z",
      queued: true,
    });
  });
});

describe("withQueuedPayments", () => {
  test("queued payments count against the balance and show in the ledger", () => {
    const bill = withQueuedPayments(
      toCheckoutBill(source),
      queuedPaymentsFor([queuedRecord({})], { sessionId: "s1" }),
    );
    expect(bill.payments.map((p) => p.id)).toEqual(["p1", "q1"]);
    expect(bill.balanceDue).toBe(38_200);
  });

  test("without queued payments the bill is unchanged", () => {
    const bill = toCheckoutBill(source);
    expect(withQueuedPayments(bill, [])).toEqual(bill);
  });
});

describe("canSettle", () => {
  test("needs lines, a zero balance and a Bill not yet settled", () => {
    const bill = toCheckoutBill(source);
    expect(canSettle(bill)).toBe(false);
    expect(canSettle({ ...bill, balanceDue: 0 })).toBe(true);
    expect(canSettle({ ...bill, balanceDue: 0, status: "settled" })).toBe(false);
    expect(canSettle({ ...bill, balanceDue: 0, lines: [] })).toBe(false);
    expect(canSettle({ ...bill, balanceDue: -10 })).toBe(false);
  });
});
