import { describe, expect, test } from "bun:test";

import { waiterSearchDefaults, waiterSearchSchema } from "./waiter-search";

describe("waiterSearchSchema", () => {
  test("defaults to the floor plan with no Table open", () => {
    expect(waiterSearchSchema.parse({})).toEqual(waiterSearchDefaults);
  });

  test("keeps a known view and a Table id", () => {
    expect(waiterSearchSchema.parse({ view: "llamadas", table: "t1" })).toEqual({
      view: "llamadas",
      table: "t1",
    });
  });

  test("falls back for an unknown view and drops an empty Table id", () => {
    expect(waiterSearchSchema.parse({ view: "x", table: "" })).toEqual(waiterSearchDefaults);
  });
});
