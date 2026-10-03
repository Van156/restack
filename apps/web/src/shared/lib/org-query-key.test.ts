import { describe, expect, test } from "bun:test";

import { orgQueryKey } from "./org-query-key";

describe("orgQueryKey", () => {
  test("starts with the organization so a prefix invalidates one tenant", () => {
    expect(orgQueryKey("o1", "areas", { locationId: "l1" })).toEqual([
      "org",
      "o1",
      "areas",
      { locationId: "l1" },
    ]);
  });

  test("differs between organizations", () => {
    expect(orgQueryKey("o1", "areas")).not.toEqual(orgQueryKey("o2", "areas"));
  });
});
