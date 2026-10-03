import { describe, expect, test } from "bun:test";

import { validatePairingForm } from "./pairing-form";

describe("validatePairingForm", () => {
  test("trims the name and keeps the chosen Stations", () => {
    expect(validatePairingForm({ name: "  Pantalla barra ", stationIds: ["s1", "s2"] })).toEqual({
      ok: true,
      value: { name: "Pantalla barra", stationIds: ["s1", "s2"] },
    });
  });

  test("needs a name and at least one Station", () => {
    const result = validatePairingForm({ name: " ", stationIds: [] });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(Object.keys(result.errors).sort()).toEqual(["name", "stationIds"]);
    }
  });

  test("limits the name to the server's 80 characters", () => {
    const result = validatePairingForm({ name: "x".repeat(81), stationIds: ["s1"] });
    expect(!result.ok && result.errors.name).toBeDefined();
  });
});
