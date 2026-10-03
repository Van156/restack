import { formatCop } from "@base-template/ui/lib/format-cop";
import { describe, expect, test } from "bun:test";

import { initialPaymentDraft, parsePesos, previewChange, validatePayment } from "./payment-form";

const cash = (amount: string, tendered = "") => ({
  tender: "cash" as const,
  amount,
  tendered,
  reference: "",
});

describe("parsePesos", () => {
  test("reads whole pesos with or without the $ sign and thousands dots", () => {
    expect(parsePesos("12500")).toBe(12_500);
    expect(parsePesos("$ 12.500")).toBe(12_500);
    expect(parsePesos(" 1.250.000 ")).toBe(1_250_000);
  });

  test("refuses empty, decimal, negative and non numeric text", () => {
    for (const text of ["", " ", "12,5", "-5", "abc", "1e3", "12.50.0x"]) {
      expect(parsePesos(text)).toBeNull();
    }
  });
});

describe("validatePayment", () => {
  test("cash with nothing handed over covers the amount with no change", () => {
    expect(validatePayment(cash("20000"), 50_000)).toEqual({
      ok: true,
      payment: { tender: "cash", amount: 20_000 },
      change: 0,
    });
  });

  test("cash records the amount handed over and the change due", () => {
    expect(validatePayment(cash("18000", "20000"), 50_000)).toEqual({
      ok: true,
      payment: { tender: "cash", amount: 18_000, tendered: 20_000 },
      change: 2_000,
    });
  });

  test("cash handed over cannot be less than the amount covered", () => {
    const result = validatePayment(cash("18000", "10000"), 50_000);
    expect(result).toEqual({
      ok: false,
      errors: { tendered: "El efectivo recibido no puede ser menor que el valor a cobrar." },
    });
  });

  test("the amount must be a positive whole number that fits the balance", () => {
    expect(validatePayment(cash("0"), 50_000).ok).toBe(false);
    expect(validatePayment(cash("abc"), 50_000).ok).toBe(false);
    const over = validatePayment(cash("50001"), 50_000);
    expect(over).toEqual({
      ok: false,
      errors: { amount: `El valor no puede superar el saldo pendiente (${formatCop(50_000)}).` },
    });
    expect(validatePayment(cash("50000"), 50_000).ok).toBe(true);
  });

  test("a card payment needs the voucher reference and ignores cash handed over", () => {
    const draft = { tender: "card" as const, amount: "30000", tendered: "99999", reference: " " };
    expect(validatePayment(draft, 50_000)).toEqual({
      ok: false,
      errors: { reference: "Escribe el número del voucher del datáfono." },
    });
    expect(validatePayment({ ...draft, reference: " 004512 " }, 50_000)).toEqual({
      ok: true,
      payment: { tender: "card", amount: 30_000, reference: "004512" },
      change: 0,
    });
  });

  test("a QR or transfer payment needs the reference seen on the cashier's own phone", () => {
    const draft = { tender: "qr_transfer" as const, amount: "30000", tendered: "", reference: "" };
    expect(validatePayment(draft, 50_000)).toEqual({
      ok: false,
      errors: { reference: "Escribe la referencia que ves en tu propio celular." },
    });
  });

  test("reports every wrong field at once", () => {
    const result = validatePayment(
      { tender: "card", amount: "", tendered: "", reference: "" },
      10_000,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(Object.keys(result.errors).sort()).toEqual(["amount", "reference"]);
    }
  });
});

describe("previewChange", () => {
  test("shows the change while typing and nothing for other cases", () => {
    expect(previewChange(cash("18000", "20000"))).toBe(2_000);
    expect(previewChange(cash("18000", ""))).toBe(0);
    expect(previewChange(cash("18000", "5000"))).toBe(0);
    expect(
      previewChange({ tender: "card", amount: "1000", tendered: "5000", reference: "x" }),
    ).toBe(0);
  });
});

describe("initialPaymentDraft", () => {
  test("starts on cash for the whole balance", () => {
    expect(initialPaymentDraft(42_000)).toEqual({
      tender: "cash",
      amount: "42000",
      tendered: "",
      reference: "",
    });
  });

  test("starts empty when nothing is due", () => {
    expect(initialPaymentDraft(0).amount).toBe("");
  });
});
