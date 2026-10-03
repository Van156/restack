import { describe, expect, test } from "bun:test";

import { activeActing, approverOptions, staffOptions, toActing } from "./acting-member";

const result = {
  memberId: "m1",
  name: "Ana",
  role: "waiter",
  locationId: "loc1",
  actingToken: "tok",
  actingTokenExpiresAt: new Date("2026-10-03T20:15:00Z"),
};

describe("activeActing", () => {
  const acting = toActing(result);

  test("is the member who switched in until the token expires", () => {
    expect(activeActing(acting, new Date("2026-10-03T20:14:59Z"), "loc1")?.memberId).toBe("m1");
  });

  test("is nobody from the instant the token expires", () => {
    expect(activeActing(acting, new Date("2026-10-03T20:15:00Z"), "loc1")).toBeNull();
  });

  test("is nobody at another Location or when no one switched in", () => {
    expect(activeActing(acting, new Date("2026-10-03T20:00:00Z"), "loc2")).toBeNull();
    expect(activeActing(null, new Date("2026-10-03T20:00:00Z"), "loc1")).toBeNull();
  });
});

describe("staffOptions and approverOptions", () => {
  const members = [
    { id: "m2", userId: "u2", role: "waiter", user: { name: "Zoe", email: "z@x.co" } },
    { id: "m1", userId: "u1", role: "admin", user: { name: "Ana", email: "a@x.co" } },
    { id: "m3", userId: "u3", role: "owner", user: { email: "o@x.co" } },
    { id: "m4", userId: "u4", role: "cashier,admin", user: { name: "Beto" } },
  ];

  test("lists everyone by name, falling back to the email", () => {
    expect(staffOptions(members).map((option) => option.name)).toEqual([
      "Ana",
      "Beto",
      "o@x.co",
      "Zoe",
    ]);
  });

  test("offers only the Owner and Administrators as approvers", () => {
    expect(approverOptions(members).map((option) => option.memberId)).toEqual(["m1", "m4", "m3"]);
  });

  test("leaves the requester out of the approvers", () => {
    expect(approverOptions(members, "m1").map((option) => option.memberId)).toEqual(["m4", "m3"]);
  });
});
