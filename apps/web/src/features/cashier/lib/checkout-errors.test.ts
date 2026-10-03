import { describe, expect, test } from "bun:test";

import { ContingencyBlockedError } from "@/features/offline-queue";

import { describeCheckoutError } from "./checkout-errors";

const server = (code: string, message: string) => Object.assign(new Error(message), { code });

describe("describeCheckoutError", () => {
  test("explains the 48 hour block and says orders and the kitchen go on", () => {
    const copy = describeCheckoutError(new ContingencyBlockedError());
    expect(copy).toContain("48 horas");
    expect(copy).toContain("pedidos");
    expect(copy).toContain("cocina");
  });

  test("maps the checkout refusals by their message", () => {
    expect(
      describeCheckoutError(server("CONFLICT", "The payment exceeds what is due (1000 COP).")),
    ).toBe("El pago supera el saldo pendiente.");
    expect(
      describeCheckoutError(server("CONFLICT", "The Bill is not fully paid (balance 5 COP).")),
    ).toBe("Todavía falta cobrar el saldo de la cuenta.");
    expect(
      describeCheckoutError(server("FORBIDDEN", "This Location does not let waiters charge.")),
    ).toBe("Este local no permite que los meseros cobren.");
    expect(
      describeCheckoutError(
        server("CONFLICT", "This Bill already has a document of another kind."),
      ),
    ).toContain("ya tiene un documento");
    expect(
      describeCheckoutError(
        server("PRECONDITION_FAILED", "Complete the DIAN habilitación before issuing documents."),
      ),
    ).toContain("habilitación");
    expect(
      describeCheckoutError(server("FORBIDDEN", "DIAN documents are part of the Completo plan.")),
    ).toContain("plan Completo");
    expect(
      describeCheckoutError(server("CONFLICT", "This Location already has an open Cash shift.")),
    ).toBe("Este local ya tiene un turno de caja abierto.");
    expect(
      describeCheckoutError(server("FORBIDDEN", "Closing with a difference needs an Override.")),
    ).toContain("Administrador");
  });

  test("falls back to the code for anything else", () => {
    expect(describeCheckoutError(server("FORBIDDEN", "nope"))).toContain("permiso");
    expect(describeCheckoutError(server("SERVICE_UNAVAILABLE", "x"))).toContain("DIAN");
    expect(describeCheckoutError(new Error("boom"))).toBe("No pudimos completar la acción.");
    expect(describeCheckoutError(undefined)).toBe("No pudimos completar la acción.");
  });
});
