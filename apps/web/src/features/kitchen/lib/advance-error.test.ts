import { describe, expect, test } from "bun:test";

import { describeAdvanceError } from "./advance-error";

describe("describeAdvanceError", () => {
  test("explains a Ticket that already moved", () => {
    expect(describeAdvanceError({ code: "CONFLICT" })).toBe(
      "La comanda ya cambió de estado. Revisa el tablero.",
    );
  });

  test("explains a Ticket the screen cannot reach", () => {
    expect(describeAdvanceError({ code: "NOT_FOUND" })).toBe(
      "Esta pantalla no puede mover esa comanda.",
    );
    expect(describeAdvanceError({ code: "FORBIDDEN" })).toBe(
      "Esta pantalla no puede mover esa comanda.",
    );
  });

  test("falls back to a retry message, also for a lost connection", () => {
    expect(describeAdvanceError(new TypeError("Failed to fetch"))).toBe(
      "No pudimos mover la comanda. Intenta de nuevo.",
    );
  });
});
