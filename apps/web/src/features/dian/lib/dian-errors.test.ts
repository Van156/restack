import { describe, expect, test } from "bun:test";

import { describeDianError } from "./dian-errors";

describe("describeDianError", () => {
  test("explains a refresh before any provider is connected", () => {
    expect(describeDianError({ code: "PRECONDITION_FAILED" })).toBe(
      "Primero conecta un proveedor.",
    );
  });

  test("explains an unreachable or unconfigured provider", () => {
    expect(describeDianError({ code: "SERVICE_UNAVAILABLE" })).toContain("proveedor");
  });

  test("explains a missing permission", () => {
    expect(describeDianError({ code: "FORBIDDEN" })).toContain("permiso");
  });

  test("falls back to a generic line for anything else", () => {
    expect(describeDianError(new Error("boom"))).toBe("No pudimos completar la acción.");
    expect(describeDianError(null)).toBe("No pudimos completar la acción.");
  });
});
