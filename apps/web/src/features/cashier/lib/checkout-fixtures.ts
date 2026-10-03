import type { CheckoutBill } from "../lib/checkout-bill";

/** An open Bill with a tip and one payment, shared by the checkout stories and tests. */
export const openBill: CheckoutBill = {
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
      itemName: "Limonada de coco",
      quantity: 1,
      note: null,
      unitTotal: 8_000,
      base: 7_407,
      tax: 593,
      total: 8_000,
      taxClass: "impoconsumo",
    },
  ],
  discountTotal: 0,
  total: 62_000,
  tip: 6_200,
  suggestedTip: { percent: 10, amount: 6_200 },
  balanceDue: 48_200,
  taxByClass: { impoconsumo: { base: 57_407, tax: 4_593 }, iva19: { base: 0, tax: 0 } },
  payments: [
    {
      id: "p1",
      tender: "cash",
      amount: 20_000,
      tendered: 20_000,
      change: 0,
      reference: null,
      registeredOffline: false,
      saleTime: "2026-10-03T20:00:00.000Z",
      queued: false,
    },
  ],
  settledAt: null,
};

export const paidBill: CheckoutBill = {
  ...openBill,
  status: "settled",
  balanceDue: 0,
  settledAt: "2026-10-03T20:10:00.000Z",
  payments: [{ ...openBill.payments[0]!, amount: 68_200, tendered: 70_000, change: 1_800 }],
};
