import { describe, expect, test } from "bun:test";

import { createRosterCache, rosterKey } from "./staff-roster";
import { memoryStorage } from "./test-support";

const roster = [
  { memberId: "m1", name: "Ana", role: "waiter", canGiveOverride: false },
  { memberId: "m2", name: "Beto", role: "supervisor", canGiveOverride: true },
];

describe("roster cache", () => {
  test("keeps the Location's Staff per organization and Location", () => {
    const storage = memoryStorage();
    createRosterCache(storage, rosterKey("org_1", "loc_1")).write(roster);

    expect(createRosterCache(storage, rosterKey("org_1", "loc_1")).read()).toEqual(roster);
    expect(createRosterCache(storage, rosterKey("org_1", "loc_2")).read()).toBeUndefined();
    expect(createRosterCache(storage, rosterKey("org_2", "loc_1")).read()).toBeUndefined();
  });

  test("stores names and roles only, never PIN material", () => {
    const storage = memoryStorage();
    const key = rosterKey("org_1", "loc_1");
    createRosterCache(storage, key).write(roster);

    expect(storage.getItem(key)).not.toContain("sealedKey");
    expect(storage.getItem(key)).not.toContain("salt");
  });

  test("reads malformed data as nothing", () => {
    const storage = memoryStorage({ a: "nope", b: JSON.stringify([{ memberId: 1 }]) });
    expect(createRosterCache(storage, "a").read()).toBeUndefined();
    expect(createRosterCache(storage, "b").read()).toBeUndefined();
  });
});
