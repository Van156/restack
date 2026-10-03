import { describe, expect, test } from "bun:test";

import { reportsSearchSchema } from "./reports-search";

describe("reportsSearchSchema", () => {
  test("defaults to the sales view of every Location on today", () => {
    expect(reportsSearchSchema.parse({})).toEqual({ view: "ventas" });
  });

  test("keeps a valid view, date and Location", () => {
    expect(
      reportsSearchSchema.parse({ view: "cocina", date: "2026-10-03", location: "loc-1" }),
    ).toEqual({ view: "cocina", date: "2026-10-03", location: "loc-1" });
  });

  test("bad values fall back instead of failing the route", () => {
    expect(reportsSearchSchema.parse({ view: "x", date: "ayer", location: "" })).toEqual({
      view: "ventas",
    });
  });
});
