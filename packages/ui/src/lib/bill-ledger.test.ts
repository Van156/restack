import { describe, expect, test } from "bun:test";

import { balanceSummary, tenderLabel, totalChange } from "./bill-ledger";

describe("balanceSummary", () => {
  test("shows what is still owed", () => {
    expect(balanceSummary(15000)).toEqual({ label: "Saldo pendiente", amount: 15000 });
  });

  test("shows a settled balance as zero owed", () => {
    expect(balanceSummary(0)).toEqual({ label: "Saldo pendiente", amount: 0 });
  });

  test("shows an overpayment as a positive amount with its own label", () => {
    expect(balanceSummary(-2000)).toEqual({ label: "Pagado de más", amount: 2000 });
  });
});

describe("totalChange", () => {
  test("adds the change handed back across payments", () => {
    expect(totalChange([{ change: 500 }, { change: 0 }, { change: 1500 }])).toBe(2000);
  });

  test("is zero without payments", () => {
    expect(totalChange([])).toBe(0);
  });
});

describe("tenderLabel", () => {
  test("labels each tender in Spanish", () => {
    expect(tenderLabel("cash")).toBe("Efectivo");
    expect(tenderLabel("card")).toBe("Tarjeta");
    expect(tenderLabel("qr_transfer")).toBe("QR / transferencia");
  });
});
