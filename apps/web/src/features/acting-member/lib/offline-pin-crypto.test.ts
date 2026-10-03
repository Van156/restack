import { describe, expect, test } from "bun:test";
import { createCipheriv, createHmac, scryptSync } from "node:crypto";

import { openOfflineSigner, type OfflineMaterial } from "./offline-pin-crypto";

const scope = { organizationId: "org_1", locationId: "loc_1" };

/**
 * Produced once by the server reference (`deriveOfflineKey`, `sealOfflineKey`, `offlineMacOf` in
 * packages/api/src/lib/offline-actor.ts) with secret "test-secret", binding "mem_dev", epoch 3 and
 * PIN 4821. If the contract in restaurant.md#offline-pin changes, regenerate it from there.
 */
const SERVER_VECTOR = {
  material: {
    memberId: "mem_1",
    name: "Ana",
    role: "waiter",
    salt: "00112233445566778899aabbccddeeff",
    params: { kdf: "scrypt", N: 16384, r: 8, p: 1, dkLen: 32 },
    sealedKey: "s2BHyP6UOBah9gTxO0r5iBOWC9zNxv4yupN1DEElNe5oY5r-7HVN-Sv6Fc75w9pA4Znd4Rx3QWB-1iYy",
    epoch: 3,
    expiresAt: new Date("2026-10-10T00:00:00Z"),
  } satisfies OfflineMaterial,
  record: { idempotencyKey: "key-1", kind: "order_line", deviceRecordedAtMs: 1760000000123 },
  mac: "DyQPAx9LyMP59hB4BuHXIqKaDxL3XJklgISJGNNlLws",
};

/** What the server does when it seals, rebuilt here so the test can vary every input. */
function seal(options: {
  pin: string;
  salt: string;
  offlineKey: Buffer;
  aad: string;
  nonce?: Buffer;
}): string {
  const pinKey = scryptSync(options.pin, Buffer.from(options.salt, "hex"), 32, {
    N: 16384,
    r: 8,
    p: 1,
  });
  const nonce = options.nonce ?? Buffer.alloc(12, 7);
  const cipher = createCipheriv("aes-256-gcm", pinKey, nonce);
  cipher.setAAD(Buffer.from(options.aad));
  const body = Buffer.concat([cipher.update(options.offlineKey), cipher.final()]);
  return Buffer.concat([nonce, body, cipher.getAuthTag()]).toString("base64url");
}

const macOf = (offlineKey: Buffer, record: { idempotencyKey: string; kind: string; ms: number }) =>
  createHmac("sha256", offlineKey)
    .update(JSON.stringify([record.idempotencyKey, record.kind, record.ms]))
    .digest("base64url");

describe("openOfflineSigner against the server reference", () => {
  test("opens the sealed key with the right PIN and signs exactly as the server verifies", async () => {
    const signer = await openOfflineSigner(SERVER_VECTOR.material, "4821", scope);

    expect(signer).not.toBeNull();
    const actor = await signer!.sign({
      idempotencyKey: SERVER_VECTOR.record.idempotencyKey,
      kind: SERVER_VECTOR.record.kind,
      deviceRecordedAt: new Date(SERVER_VECTOR.record.deviceRecordedAtMs),
    });
    expect(actor).toEqual({ memberId: "mem_1", epoch: 3, mac: SERVER_VECTOR.mac });
  });

  test("a wrong PIN fails the GCM tag", async () => {
    expect(await openOfflineSigner(SERVER_VECTOR.material, "4822", scope)).toBeNull();
  });

  test("material for another Location, organization or epoch does not open", async () => {
    const material = SERVER_VECTOR.material;
    expect(await openOfflineSigner(material, "4821", { ...scope, locationId: "loc_2" })).toBeNull();
    expect(
      await openOfflineSigner(material, "4821", { ...scope, organizationId: "org_2" }),
    ).toBeNull();
    expect(await openOfflineSigner({ ...material, epoch: 4 }, "4821", scope)).toBeNull();
  });

  test("a truncated or tampered sealed key is a wrong PIN, not an error", async () => {
    const material = SERVER_VECTOR.material;
    expect(await openOfflineSigner({ ...material, sealedKey: "AAAA" }, "4821", scope)).toBeNull();
    const flipped = `${material.sealedKey.slice(0, -2)}AA`;
    expect(await openOfflineSigner({ ...material, sealedKey: flipped }, "4821", scope)).toBeNull();
  });

  test("seals built from other inputs follow the same contract", async () => {
    const offlineKey = Buffer.alloc(32, 9);
    const salt = "ffeeddccbbaa99887766554433221100";
    const sealedKey = seal({
      pin: "123456",
      salt,
      offlineKey,
      aad: JSON.stringify(["org_1", "loc_1", "mem_2", 1]),
    });
    const material = { ...SERVER_VECTOR.material, memberId: "mem_2", salt, sealedKey, epoch: 1 };

    const signer = await openOfflineSigner(material, "123456", scope);
    const at = new Date("2026-10-03T20:00:00.456Z");
    const actor = await signer!.sign({
      idempotencyKey: "k",
      kind: "send_to_kitchen",
      deviceRecordedAt: at,
    });

    expect(actor.mac).toBe(
      macOf(offlineKey, { idempotencyKey: "k", kind: "send_to_kitchen", ms: at.getTime() }),
    );
  });

  test("refuses a KDF the contract does not define", async () => {
    const material = {
      ...SERVER_VECTOR.material,
      params: { ...SERVER_VECTOR.material.params, kdf: "argon2" as "scrypt" },
    };
    await expect(openOfflineSigner(material, "4821", scope)).rejects.toThrow("scrypt");
  });
});
