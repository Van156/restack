import { describe, expect, test } from "bun:test";

import { activeLocationStorageKey, resolveActiveLocationId } from "./active-location";

const locations = [
  { id: "a", active: false },
  { id: "b", active: true },
  { id: "c", active: true },
];

describe("resolveActiveLocationId", () => {
  test("keeps the stored Location while it is still accessible", () => {
    expect(resolveActiveLocationId(locations, "c")).toBe("c");
  });

  test("falls back to the first active Location when the stored one is gone", () => {
    expect(resolveActiveLocationId(locations, "zzz")).toBe("b");
    expect(resolveActiveLocationId(locations, null)).toBe("b");
  });

  test("uses the first Location when none is active", () => {
    expect(resolveActiveLocationId([{ id: "a", active: false }], null)).toBe("a");
  });

  test("is null without Locations", () => {
    expect(resolveActiveLocationId([], "a")).toBeNull();
  });
});

describe("activeLocationStorageKey", () => {
  test("is scoped to the organization", () => {
    expect(activeLocationStorageKey("org1")).not.toBe(activeLocationStorageKey("org2"));
  });
});
