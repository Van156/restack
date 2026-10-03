import { describe, expect, test } from "bun:test";

import { buildStaffRows, rowActions } from "./staff-rows";

const locations = [
  { id: "l1", name: "Centro" },
  { id: "l2", name: "Norte" },
];
const members = [
  { id: "m2", userId: "u2", role: "waiter", user: { name: "Zoe", email: "zoe@x.co" } },
  { id: "m1", userId: "u1", role: "owner", user: { name: "Ana", email: "ana@x.co" } },
  { id: "m3", userId: "u3", role: "cashier", user: { name: "Bo", email: "bo@x.co" } },
  { id: "m4", userId: "u4", role: "waiter" },
];
const assignments = [
  { memberId: "m2", locationIds: ["l2", "l1"] },
  { memberId: "m9", locationIds: ["l1"] },
];

describe("buildStaffRows", () => {
  const rows = buildStaffRows(members, assignments, locations);

  test("sorts by name and keeps unnamed members last", () => {
    expect(rows.map((row) => row.name)).toEqual(["Ana", "Bo", "Zoe", ""]);
  });

  test("resolves assigned Location names in the Location order", () => {
    expect(rows.find((row) => row.memberId === "m2")).toMatchObject({
      locationIds: ["l2", "l1"],
      locationNames: ["Centro", "Norte"],
    });
  });

  test("a member without assignment rows has no Locations", () => {
    expect(rows.find((row) => row.memberId === "m3")).toMatchObject({
      locationIds: [],
      locationNames: [],
    });
  });

  test("the Owner is flagged and needs no assignments", () => {
    expect(rows.find((row) => row.memberId === "m1")).toMatchObject({ isOwner: true });
  });

  test("ignores assignments of members outside the directory and unknown Locations", () => {
    const withGhost = buildStaffRows(
      members,
      [{ memberId: "m3", locationIds: ["l1", "gone"] }],
      locations,
    );
    expect(withGhost.find((row) => row.memberId === "m3")?.locationNames).toEqual(["Centro"]);
  });
});

describe("rowActions", () => {
  const owner = { isOwner: true } as const;
  const waiter = { isOwner: false } as const;

  test("nobody edits the Owner's Locations", () => {
    expect(rowActions({ callerIsOwner: true, row: owner }).canEditLocations).toBe(false);
  });

  test("only the Owner resets the Owner's PIN", () => {
    expect(rowActions({ callerIsOwner: false, row: owner }).canResetPin).toBe(false);
    expect(rowActions({ callerIsOwner: true, row: owner }).canResetPin).toBe(true);
  });

  test("Administrators manage Locations and PIN of other Staff", () => {
    expect(rowActions({ callerIsOwner: false, row: waiter })).toEqual({
      canEditLocations: true,
      canResetPin: true,
    });
  });
});
