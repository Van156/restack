import { describe, expect, test } from "bun:test";

import { emptyConnectionForm, formFromConnection, validateConnectionForm } from "./connection-form";

describe("validateConnectionForm", () => {
  const valid = {
    provider: "alegra" as const,
    companyReference: " ACME-1 ",
    numberingPrefix: " pos ",
  };

  test("trims both fields and keeps the provider", () => {
    expect(validateConnectionForm(valid, "not_started")).toEqual({
      ok: true,
      value: {
        provider: "alegra",
        companyReference: "ACME-1",
        numberingPrefix: "pos",
        habilitacion: "in_progress",
      },
    });
  });

  test("a blank prefix is sent as none", () => {
    const result = validateConnectionForm({ ...valid, numberingPrefix: "  " }, "not_started");
    expect(result.ok && result.value.numberingPrefix).toBeNull();
  });

  test("saving the connection of a new Location starts the habilitación, an existing state is kept", () => {
    const fresh = validateConnectionForm(valid, "not_started");
    expect(fresh.ok && fresh.value.habilitacion).toBe("in_progress");
    const enabled = validateConnectionForm(valid, "enabled");
    expect(enabled.ok && enabled.value.habilitacion).toBe("enabled");
  });

  test("requires the company reference and caps lengths like the server", () => {
    const missing = validateConnectionForm({ ...valid, companyReference: " " }, "not_started");
    expect(!missing.ok && missing.errors.companyReference).toBeDefined();
    const long = validateConnectionForm(
      { ...valid, companyReference: "x".repeat(121), numberingPrefix: "y".repeat(21) },
      "not_started",
    );
    expect(!long.ok && Object.keys(long.errors).sort()).toEqual([
      "companyReference",
      "numberingPrefix",
    ]);
  });
});

describe("form values", () => {
  test("start empty on Alegra, the only provider", () => {
    expect(emptyConnectionForm()).toEqual({
      provider: "alegra",
      companyReference: "",
      numberingPrefix: "",
    });
  });

  test("an existing connection fills the form", () => {
    expect(
      formFromConnection({ provider: "alegra", companyReference: "A", numberingPrefix: null }),
    ).toEqual({ provider: "alegra", companyReference: "A", numberingPrefix: "" });
  });
});
