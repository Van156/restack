import { hashPin } from "@base-template/auth/staff-credentials";
import { describe, expect, test } from "bun:test";

import { toHex } from "../testing/offline-client";

import {
  OFFLINE_PIN_KDF,
  deriveOfflineKey,
  offlineMacOf,
  openSealedKey,
  sealOfflineKey,
  verifyOfflineMac,
} from "./offline-actor";

const SECRET = "a-32-character-long-test-secret";
const scope = {
  organizationId: "org-1",
  locationId: "loc-1",
  memberId: "member-1",
  binding: "member-cashier",
  epoch: 3,
};

describe("offline key", () => {
  test("is deterministic and bound to every part of its scope", () => {
    const key = deriveOfflineKey(SECRET, scope);
    expect(key).toHaveLength(32);
    expect(toHex(deriveOfflineKey(SECRET, scope))).toBe(toHex(key));
    for (const change of [
      { organizationId: "org-2" },
      { locationId: "loc-2" },
      { memberId: "member-2" },
      { binding: "member-other" },
      { epoch: 4 },
    ]) {
      expect(toHex(deriveOfflineKey(SECRET, { ...scope, ...change }))).not.toBe(toHex(key));
    }
    expect(toHex(deriveOfflineKey("another-32-character-long-secret", scope))).not.toBe(toHex(key));
  });
});

describe("sealed key", () => {
  test("opens with the key derived from the right PIN and never with another", async () => {
    const stored = await hashPin("4821");
    const [saltHex, keyHex] = stored.split(":") as [string, string];
    const offlineKey = deriveOfflineKey(SECRET, scope);
    const sealed = sealOfflineKey(Buffer.from(keyHex, "hex"), offlineKey, "aad");
    expect(sealed).not.toContain(keyHex);

    const { scryptSync } = await import("node:crypto");
    const derive = (pin: string) =>
      scryptSync(pin, Buffer.from(saltHex, "hex"), OFFLINE_PIN_KDF.dkLen, {
        N: OFFLINE_PIN_KDF.N,
        r: OFFLINE_PIN_KDF.r,
        p: OFFLINE_PIN_KDF.p,
      });
    const opened = openSealedKey(derive("4821"), sealed, "aad");
    expect(opened ? toHex(opened) : null).toBe(toHex(offlineKey));
    expect(openSealedKey(derive("4822"), sealed, "aad")).toBeNull();
    expect(openSealedKey(derive("4821"), sealed, "other aad")).toBeNull();
  });

  test("two seals of the same key differ (random nonce)", () => {
    const pinKey = Buffer.alloc(32, 7);
    const offlineKey = deriveOfflineKey(SECRET, scope);
    expect(sealOfflineKey(pinKey, offlineKey, "a")).not.toBe(
      sealOfflineKey(pinKey, offlineKey, "a"),
    );
  });
});

describe("record mac", () => {
  const record = {
    idempotencyKey: "k-1",
    kind: "order_line",
    deviceRecordedAtMs: 1_790_000_000_000,
  };

  test("verifies for the record it signed and for nothing else", () => {
    const key = deriveOfflineKey(SECRET, scope);
    const mac = offlineMacOf(key, record);
    expect(verifyOfflineMac(key, record, mac)).toBe(true);
    expect(verifyOfflineMac(key, { ...record, idempotencyKey: "k-2" }, mac)).toBe(false);
    expect(verifyOfflineMac(key, { ...record, kind: "void" }, mac)).toBe(false);
    expect(
      verifyOfflineMac(key, { ...record, deviceRecordedAtMs: record.deviceRecordedAtMs + 1 }, mac),
    ).toBe(false);
    expect(verifyOfflineMac(deriveOfflineKey(SECRET, { ...scope, epoch: 4 }), record, mac)).toBe(
      false,
    );
  });

  test("malformed macs never verify and never throw", () => {
    const key = deriveOfflineKey(SECRET, scope);
    for (const mac of ["", "x", "!!!", "A".repeat(500)]) {
      expect(verifyOfflineMac(key, record, mac)).toBe(false);
    }
  });
});
