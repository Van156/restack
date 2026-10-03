import { describe, expect, test } from "bun:test";

import { setupSearchSchema } from "./setup-search";

describe("setupSearchSchema", () => {
  test("keeps a known step", () => {
    expect(setupSearchSchema.parse({ step: "menu" })).toEqual({ step: "menu" });
  });

  test("falls back to areas for a missing or unknown step", () => {
    expect(setupSearchSchema.parse({})).toEqual({ step: "areas" });
    expect(setupSearchSchema.parse({ step: "nope" })).toEqual({ step: "areas" });
  });
});
