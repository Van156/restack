import { describe, expect, test } from "bun:test";

import { toSalesView, type DailyReportSource } from "./sales-view";

const daily: DailyReportSource = {
  date: "2026-10-03",
  billCount: 3,
  salesTotal: 100_000,
  tipTotal: 10_000,
  collectedTotal: 110_000,
  tenders: {
    cash: { count: 2, amount: 40_000 },
    card: { count: 1, amount: 60_000 },
    qr_transfer: { count: 1, amount: 10_000 },
  },
  byLocation: [
    {
      locationId: "a",
      name: "Centro",
      billCount: 2,
      salesTotal: 70_000,
      tipTotal: 7_000,
      collectedTotal: 77_000,
      tenders: {
        cash: { count: 1, amount: 17_000 },
        card: { count: 1, amount: 60_000 },
        qr_transfer: { count: 0, amount: 0 },
      },
    },
  ],
  documents: {
    total: 3,
    byStatus: { pending: 1, issued: 2, rejected: 0 },
    byKind: { pos_equivalent: 2, factura: 1 },
  },
};

describe("toSalesView", () => {
  test("lists tenders with Spanish labels and keeps tips apart from sales", () => {
    const view = toSalesView(daily);
    expect(view.tenders.map((row) => [row.label, row.count, row.amount])).toEqual([
      ["Efectivo", 2, 40_000],
      ["Tarjeta", 1, 60_000],
      ["QR / transferencia", 1, 10_000],
    ]);
    expect(view.salesTotal).toBe(100_000);
    expect(view.tipTotal).toBe(10_000);
    expect(view.collectedTotal).toBe(110_000);
  });

  test("document counts by status in the order pending, issued, rejected", () => {
    expect(toSalesView(daily).documents).toEqual({
      total: 3,
      rows: [
        { status: "pending", label: "Pendientes", count: 1 },
        { status: "issued", label: "Emitidos", count: 2 },
        { status: "rejected", label: "Rechazados", count: 0 },
      ],
    });
  });

  test("one row per Location with its totals", () => {
    expect(toSalesView(daily).locations).toEqual([
      { locationId: "a", name: "Centro", billCount: 2, salesTotal: 70_000, tipTotal: 7_000 },
    ]);
  });

  test("a day with no Bills is flagged empty", () => {
    expect(toSalesView({ ...daily, billCount: 0 }).isEmpty).toBe(true);
    expect(toSalesView(daily).isEmpty).toBe(false);
  });
});
