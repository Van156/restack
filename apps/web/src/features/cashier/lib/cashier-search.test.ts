import { describe, expect, test } from "bun:test";

import { cashierSearchDefaults, cashierSearchSchema } from "./cashier-search";

describe("cashierSearchSchema", () => {
  test("defaults to the Bills to charge with none open", () => {
    expect(cashierSearchSchema.parse({})).toEqual(cashierSearchDefaults);
  });

  test("keeps a known view and an open session", () => {
    expect(cashierSearchSchema.parse({ view: "turno", session: "s1" })).toEqual({
      view: "turno",
      session: "s1",
    });
  });

  test("falls back for an unknown view and drops an empty session id", () => {
    expect(cashierSearchSchema.parse({ view: "x", session: "" })).toEqual(cashierSearchDefaults);
  });
});
