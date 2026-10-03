import { describe, expect, test } from "bun:test";

import { dianSearchSchema } from "./dian-search";

describe("dianSearchSchema", () => {
  test("defaults to the connection view", () => {
    expect(dianSearchSchema.parse({})).toEqual({ view: "conexion" });
  });

  test("keeps a known view and falls back on a bad one", () => {
    expect(dianSearchSchema.parse({ view: "incidentes" })).toEqual({ view: "incidentes" });
    expect(dianSearchSchema.parse({ view: "x" })).toEqual({ view: "conexion" });
  });
});
