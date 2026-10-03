import { describe, expect, test } from "bun:test";

import { toShiftLedgerView } from "./shift-ledger";

describe("toShiftLedgerView", () => {
  test("keeps opening cash, takings by tender, tips, change given and the expected amounts", () => {
    const view = toShiftLedgerView({
      shift: { id: "sh1", openingAmount: 100_000, openedAt: new Date("2026-10-03T13:00:00Z") },
      takings: {
        cash: { amount: 50_000, count: 2 },
        card: { amount: 80_000, count: 1 },
        qr_transfer: { amount: 0, count: 0 },
      },
      tips: 13_000,
      changeGiven: 2_000,
      expected: { cash: 150_000, card: 80_000, qr_transfer: 0, total: 230_000 },
    });
    expect(view).toEqual({
      shiftId: "sh1",
      openingAmount: 100_000,
      openedAt: "2026-10-03T13:00:00.000Z",
      takings: {
        cash: { amount: 50_000, count: 2 },
        card: { amount: 80_000, count: 1 },
        qr_transfer: { amount: 0, count: 0 },
      },
      tips: 13_000,
      changeGiven: 2_000,
      expected: { cash: 150_000, card: 80_000, qr_transfer: 0, total: 230_000 },
    });
  });
});
