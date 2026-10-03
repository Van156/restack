import { PIN_KDF_PARAMS } from "@base-template/auth/staff-credentials";
import { scryptSync } from "node:crypto";

import { offlineMacOf, openSealedKey, sealAad } from "../lib/offline-actor";

export type OfflineMaterial = {
  memberId: string;
  name: string;
  role: string;
  salt: string;
  params: { kdf: string; N: number; r: number; p: number; dkLen: number };
  sealedKey: string;
  epoch: number;
  expiresAt: Date;
};

/**
 * What the web client does with one member's material: scrypt the PIN, open the sealed key. Null
 * for a wrong PIN. A test double of the device, written against the documented contract.
 */
export function openOffline(
  material: OfflineMaterial,
  pin: string,
  scope: { organizationId: string; locationId: string },
): Buffer | null {
  const pinKey = scryptSync(pin, Buffer.from(material.salt, "hex"), PIN_KDF_PARAMS.dkLen, {
    N: material.params.N,
    r: material.params.r,
    p: material.params.p,
  });
  return openSealedKey(
    pinKey,
    material.sealedKey,
    sealAad({ ...scope, memberId: material.memberId, epoch: material.epoch }),
  );
}

/** The `offlineActor` a device attaches to a record it queued after a correct offline PIN. */
export function offlineActorFor(
  material: OfflineMaterial,
  offlineKey: Buffer,
  record: { idempotencyKey: string; kind: string; deviceRecordedAt: Date },
) {
  return {
    memberId: material.memberId,
    epoch: material.epoch,
    mac: offlineMacOf(offlineKey, {
      idempotencyKey: record.idempotencyKey,
      kind: record.kind,
      deviceRecordedAtMs: record.deviceRecordedAt.getTime(),
    }),
  };
}

/** Hex of key bytes, for comparing keys in assertions. */
export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
