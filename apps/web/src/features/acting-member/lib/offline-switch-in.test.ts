import { describe, expect, test } from "bun:test";

import { switchInOffline } from "./offline-switch-in";
import type { StoredCredentials } from "./offline-credentials";
import type { OfflineMaterial, OfflineSigner } from "./offline-pin-crypto";
import { MAX_PIN_ATTEMPTS, createPinThrottle } from "./pin-throttle";
import { memoryStorage } from "./test-support";

const now = new Date("2026-10-03T20:00:00Z");
const scope = { organizationId: "org_1", locationId: "loc_1" };

const material = (memberId: string, name: string): OfflineMaterial => ({
  memberId,
  name,
  role: "waiter",
  salt: "00".repeat(16),
  params: { kdf: "scrypt", N: 16384, r: 8, p: 1, dkLen: 32 },
  sealedKey: "sealed",
  epoch: 1,
  expiresAt: new Date("2026-10-10T00:00:00Z"),
});

const credentials: StoredCredentials = {
  fetchedAt: now,
  members: [material("m1", "Ana"), material("m2", "Beto")],
};

function setup(correctPin = "4821") {
  const opened: string[] = [];
  const open = async (entry: OfflineMaterial, pin: string): Promise<OfflineSigner | null> => {
    opened.push(`${entry.memberId}:${pin}`);
    return pin === correctPin
      ? {
          memberId: entry.memberId,
          epoch: entry.epoch,
          sign: async () => ({ memberId: entry.memberId, epoch: entry.epoch, mac: "m" }),
        }
      : null;
  };
  const throttle = createPinThrottle(memoryStorage(), "k");
  const run = (memberId: string, pin: string, stored: StoredCredentials | null = credentials) =>
    switchInOffline(
      { credentials: stored ?? undefined, throttle, open, scope, now },
      memberId,
      pin,
    );
  return { run, opened, throttle };
}

describe("switchInOffline", () => {
  test("the right PIN starts an offline turn for that member at this Location", async () => {
    const { run } = setup();
    const result = await run("m1", "4821");

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.acting).toMatchObject({ memberId: "m1", name: "Ana", locationId: "loc_1" });
      expect(result.acting.credential.kind).toBe("offline");
    }
  });

  test("a wrong PIN says how many tries are left", async () => {
    const { run } = setup();

    expect(await run("m1", "0000")).toEqual({
      status: "wrong_pin",
      attemptsLeft: MAX_PIN_ATTEMPTS - 1,
    });
    expect(await run("m1", "0000")).toEqual({
      status: "wrong_pin",
      attemptsLeft: MAX_PIN_ATTEMPTS - 2,
    });
  });

  test("the fifth wrong PIN locks the member without trying a sixth", async () => {
    const { run, opened } = setup();
    for (let attempt = 1; attempt < MAX_PIN_ATTEMPTS; attempt += 1) {
      await run("m1", "0000");
    }

    const last = await run("m1", "0000");
    expect(last.status).toBe("locked");

    const tried = opened.length;
    const blocked = await run("m1", "4821");
    expect(blocked.status).toBe("locked");
    expect(opened).toHaveLength(tried);
  });

  test("a right PIN clears the failures of that member only", async () => {
    const { run } = setup();
    await run("m1", "0000");
    await run("m2", "0000");
    await run("m1", "4821");

    expect(await run("m1", "0000")).toEqual({
      status: "wrong_pin",
      attemptsLeft: MAX_PIN_ATTEMPTS - 1,
    });
    expect(await run("m2", "0000")).toEqual({
      status: "wrong_pin",
      attemptsLeft: MAX_PIN_ATTEMPTS - 2,
    });
  });

  test("a member with no stored material cannot switch in offline, and is not counted", async () => {
    const { run, opened, throttle } = setup();

    expect(await run("m9", "4821")).toEqual({ status: "no_material" });
    expect(await run("m1", "4821", null)).toEqual({ status: "no_material" });
    expect(opened).toEqual([]);
    expect(throttle.check("m9", now)).toEqual({ locked: false });
  });
});
