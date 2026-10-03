import { scryptAsync } from "@noble/hashes/scrypt.js";

/**
 * Device side of the offline PIN contract: docs/architecture/restaurant.md#offline-pin. The server
 * seals a per-member key under the PIN; typing the right PIN here opens it, and records signed
 * with it prove the PIN was typed on a device that holds the material.
 */

/** One Staff member's material as `staff.offlineCredentials` returns it. Never holds the PIN. */
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

export type OfflineScope = { organizationId: string; locationId: string };

/** The `offlineActor` a record carries instead of an acting token. */
export type OfflineActor = { memberId: string; epoch: number; mac: string };

/** The part of a record the mac covers. */
export type SignableRecord = { idempotencyKey: string; kind: string; deviceRecordedAt: Date };

/** Signs records for one member's turn. The key is not extractable and lives only in memory. */
export type OfflineSigner = {
  memberId: string;
  epoch: number;
  sign(record: SignableRecord): Promise<OfflineActor>;
};

const NONCE_BYTES = 12;
const TAG_BYTES = 16;
const TAG_BITS = TAG_BYTES * 8;

const encoder = new TextEncoder();

function bytesFromHex(hex: string): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

function bytesFromBase64Url(text: string): Uint8Array<ArrayBuffer> {
  const binary = atob(text.replaceAll("-", "+").replaceAll("_", "/"));
  return Uint8Array.from(binary, (char) => char.codePointAt(0) ?? 0);
}

function base64UrlOf(bytes: Uint8Array): string {
  return btoa(String.fromCodePoint(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

/** AES-256-GCM open of `nonce || ciphertext || tag`; null when the tag fails (a wrong PIN). */
async function openSealed(
  pinKey: Uint8Array<ArrayBuffer>,
  sealedKey: string,
  aad: string,
): Promise<Uint8Array<ArrayBuffer> | null> {
  let sealed: Uint8Array<ArrayBuffer>;
  try {
    sealed = bytesFromBase64Url(sealedKey);
  } catch {
    return null;
  }
  if (sealed.length <= NONCE_BYTES + TAG_BYTES) {
    return null;
  }
  const key = await crypto.subtle.importKey("raw", pinKey, "AES-GCM", false, ["decrypt"]);
  try {
    const plain = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: sealed.subarray(0, NONCE_BYTES),
        additionalData: encoder.encode(aad),
        tagLength: TAG_BITS,
      },
      key,
      sealed.subarray(NONCE_BYTES),
    );
    return new Uint8Array(plain);
  } catch {
    return null;
  }
}

/**
 * Switches a member in offline: scrypt of the PIN, then the sealed key opened under it. Null for a
 * wrong PIN (or material that does not belong to this Location and epoch). The PIN-derived key and
 * the raw offline key are wiped as soon as they are imported; only the signer keeps a
 * non-extractable HMAC key. scrypt costs 16 MiB and a few hundred milliseconds.
 */
export async function openOfflineSigner(
  material: OfflineMaterial,
  pin: string,
  scope: OfflineScope,
): Promise<OfflineSigner | null> {
  const { params } = material;
  if (params.kdf !== "scrypt") {
    throw new Error(`The offline PIN contract defines scrypt only, got "${params.kdf}".`);
  }
  const pinKey = Uint8Array.from(
    await scryptAsync(encoder.encode(pin), bytesFromHex(material.salt), {
      N: params.N,
      r: params.r,
      p: params.p,
      dkLen: params.dkLen,
    }),
  );
  const aad = JSON.stringify([
    scope.organizationId,
    scope.locationId,
    material.memberId,
    material.epoch,
  ]);
  let offlineKey: Uint8Array<ArrayBuffer> | null = null;
  let macKey: CryptoKey;
  try {
    offlineKey = await openSealed(pinKey, material.sealedKey, aad);
    if (!offlineKey) {
      return null;
    }
    macKey = await crypto.subtle.importKey(
      "raw",
      offlineKey,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
  } finally {
    pinKey.fill(0);
    offlineKey?.fill(0);
  }

  return {
    memberId: material.memberId,
    epoch: material.epoch,
    async sign(record) {
      const message = JSON.stringify([
        record.idempotencyKey,
        record.kind,
        record.deviceRecordedAt.getTime(),
      ]);
      const mac = await crypto.subtle.sign("HMAC", macKey, encoder.encode(message));
      return {
        memberId: material.memberId,
        epoch: material.epoch,
        mac: base64UrlOf(new Uint8Array(mac)),
      };
    },
  };
}
