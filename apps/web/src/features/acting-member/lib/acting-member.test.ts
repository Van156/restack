import { describe, expect, test } from "bun:test";

import {
  OFFLINE_TURN_MS,
  activeActing,
  actingToken,
  approverOptions,
  endedTurn,
  rosterOptions,
  toActing,
  toOfflineActing,
} from "./acting-member";
import type { OfflineMaterial, OfflineSigner } from "./offline-pin-crypto";

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

describe("an offline switch-in", () => {
  const material: OfflineMaterial = {
    memberId: "m2",
    name: "Beto",
    role: "cashier",
    salt: "00",
    params: { kdf: "scrypt", N: 16384, r: 8, p: 1, dkLen: 32 },
    sealedKey: "sealed",
    epoch: 4,
    expiresAt: new Date("2026-10-10T00:00:00Z"),
  };
  const signer: OfflineSigner = {
    memberId: "m2",
    epoch: 4,
    sign: async () => ({ memberId: "m2", epoch: 4, mac: "mac" }),
  };
  const now = new Date("2026-10-03T20:00:00Z");
  const acting = toOfflineActing({ material, signer, locationId: "loc1", now });

  test("acts for the length of a turn, like an acting token", () => {
    expect(OFFLINE_TURN_MS).toBe(15 * 60 * 1000);
    const turnEnd = new Date(now.getTime() + OFFLINE_TURN_MS);
    expect(activeActing(acting, new Date(turnEnd.getTime() - 1), "loc1")?.name).toBe("Beto");
    expect(activeActing(acting, turnEnd, "loc1")).toBeNull();
  });

  test("has no acting token to send; its records are signed instead", () => {
    expect(actingToken(acting)).toBeUndefined();
    expect(acting.credential).toEqual({ kind: "offline", signer });
    expect(actingToken(toActing(result))).toBe("tok");
    expect(actingToken(null)).toBeUndefined();
  });
});

describe("endedTurn", () => {
  test("drops the signer so the offline key leaves memory when the turn ends", () => {
    const signer: OfflineSigner = {
      memberId: "m2",
      epoch: 4,
      sign: async () => ({ memberId: "m2", epoch: 4, mac: "mac" }),
    };
    const ended = endedTurn({
      memberId: "m2",
      name: "Beto",
      role: "cashier",
      locationId: "loc1",
      credential: { kind: "offline", signer },
      expiresAt: new Date("2026-10-03T20:15:00Z"),
    });

    expect(ended.credential).toEqual({ kind: "ended" });
    expect(ended.name).toBe("Beto");
    expect(actingToken(ended)).toBeUndefined();
    expect(activeActing(ended, new Date("2026-10-03T20:00:00Z"), "loc1")).toBeNull();
  });
});

describe("rosterOptions and approverOptions", () => {
  const roster = [
    { memberId: "m2", name: "Zoe", role: "waiter", canGiveOverride: false },
    { memberId: "m1", name: "Ana", role: "admin", canGiveOverride: true },
    { memberId: "m3", name: "Óscar", role: "owner", canGiveOverride: true },
    { memberId: "m4", name: "Beto", role: "supervisor", canGiveOverride: true },
  ];

  test("lists the Location's Staff by name", () => {
    expect(rosterOptions(roster).map((option) => option.name)).toEqual([
      "Ana",
      "Beto",
      "Óscar",
      "Zoe",
    ]);
  });

  test("offers everyone who can give an Override, custom Roles included", () => {
    expect(approverOptions(roster).map((option) => option.memberId)).toEqual(["m1", "m4", "m3"]);
  });

  test("leaves the requester out of the approvers", () => {
    expect(approverOptions(roster, "m1").map((option) => option.memberId)).toEqual(["m4", "m3"]);
  });
});
