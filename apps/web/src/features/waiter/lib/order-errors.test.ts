import { describe, expect, test } from "bun:test";

import { OfflineRequiredError, OnlineSwitchInRequiredError } from "@/features/offline-queue";

import { describeOrderError } from "./order-errors";

const failure = (code: string, message: string) => Object.assign(new Error(message), { code });

describe("describeOrderError", () => {
  test("explains an unrouted item with the names the server lists", () => {
    expect(
      describeOrderError(
        failure("CONFLICT", "No Station at this Location prepares: Jugo, Postre."),
      ),
    ).toBe(
      "Estos productos no tienen estación en este local: Jugo, Postre. Pide a un administrador que los asigne.",
    );
  });

  test("explains an occupied Table", () => {
    expect(describeOrderError(failure("CONFLICT", "This Table already has an open session."))).toBe(
      "Esta mesa ya tiene una cuenta abierta.",
    );
  });

  test("a sold-out item and permission failures get their own copy", () => {
    expect(
      describeOrderError(failure("CONFLICT", '"Hamburguesa" is sold out at this Location.')),
    ).toBe("Ese producto se agotó.");
    expect(describeOrderError(failure("FORBIDDEN", "x"))).toBe(
      "No tienes permiso para hacer esto o tu sesión de PIN venció.",
    );
  });

  test("an action that needs the server explains there is no connection", () => {
    expect(describeOrderError(new OfflineRequiredError())).toBe(
      "Sin conexión: esto necesita internet. Inténtalo cuando vuelva la conexión.",
    );
  });

  test("a discount after an offline switch-in asks for the PIN online", () => {
    expect(describeOrderError(new OnlineSwitchInRequiredError())).toBe(
      "Para aplicar un descuento entra con tu PIN cuando haya conexión.",
    );
  });

  test("falls back to a generic sentence for anything else", () => {
    expect(describeOrderError(new Error("boom"))).toBe("No pudimos completar la acción.");
  });
});
