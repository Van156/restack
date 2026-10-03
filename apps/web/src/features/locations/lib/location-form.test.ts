import { describe, expect, test } from "bun:test";

import { emptyLocationForm, validateLocationForm, type LocationFormValues } from "./location-form";

const valid: LocationFormValues = {
  name: "  Sede Centro ",
  address: "Calle 10 # 5-20",
  nit: "",
  isFranchise: false,
  waitersCanCharge: true,
  suggestedTipPercent: "10",
};

describe("validateLocationForm", () => {
  test("trims the text fields and parses the tip percent", () => {
    expect(validateLocationForm(valid)).toEqual({
      ok: true,
      value: {
        name: "Sede Centro",
        address: "Calle 10 # 5-20",
        nit: null,
        isFranchise: false,
        waitersCanCharge: true,
        suggestedTipPercent: 10,
      },
    });
  });

  test("canonicalizes a valid NIT and treats a blank one as none", () => {
    const withNit = validateLocationForm({ ...valid, nit: " 800.197.268-4 " });
    expect(withNit.ok && withNit.value.nit).toBe("800197268-4");
  });

  test("rejects a NIT with a wrong check digit or a bad format", () => {
    for (const nit of ["800197268-5", "abc"]) {
      const result = validateLocationForm({ ...valid, nit });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.nit).toBeDefined();
      }
    }
  });

  test("requires a name", () => {
    const result = validateLocationForm({ ...valid, name: "   " });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.name).toBeDefined();
    }
  });

  test("rejects a tip above the legal 10 percent and non-integers", () => {
    for (const suggestedTipPercent of ["11", "-1", "2.5", "", "abc"]) {
      const result = validateLocationForm({ ...valid, suggestedTipPercent });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.suggestedTipPercent).toBeDefined();
      }
    }
  });

  test("accepts 0 and 10 as the tip bounds", () => {
    for (const suggestedTipPercent of ["0", "10"]) {
      expect(validateLocationForm({ ...valid, suggestedTipPercent }).ok).toBe(true);
    }
  });

  test("an empty address is sent as an empty string for the update to clear it", () => {
    const result = validateLocationForm({ ...valid, address: " " });
    expect(result.ok && result.value.address).toBe("");
  });
});

describe("emptyLocationForm", () => {
  test("defaults to the suggested 10 percent tip and no waiter charging", () => {
    expect(emptyLocationForm()).toMatchObject({
      suggestedTipPercent: "10",
      waitersCanCharge: false,
      isFranchise: false,
    });
  });
});
