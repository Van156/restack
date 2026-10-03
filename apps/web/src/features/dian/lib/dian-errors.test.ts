import { describe, expect, test } from "bun:test";

import { describeDianError, missingNitNotice } from "./dian-errors";

describe("describeDianError", () => {
  test("explains a refresh before any provider is connected", () => {
    expect(describeDianError({ code: "PRECONDITION_FAILED" })).toBe(
      "Primero conecta un proveedor.",
    );
  });

  test("tells to set the Location NIT when the server refuses to connect without it", () => {
    const error = {
      code: "PRECONDITION_FAILED",
      message: "Set the Location NIT before connecting DIAN.",
    };
    expect(describeDianError(error)).toContain("NIT");
    expect(describeDianError(error)).toContain("Locales");
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

describe("missingNitNotice", () => {
  test("warns before connecting when the Location has no NIT", () => {
    expect(missingNitNotice(null)).toContain("NIT");
    expect(missingNitNotice("")).toContain("NIT");
  });

  test("is silent once the Location has a NIT", () => {
    expect(missingNitNotice("900123456-8")).toBeNull();
  });
});
