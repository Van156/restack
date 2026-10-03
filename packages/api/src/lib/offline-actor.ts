import { PIN_KDF_PARAMS } from "@base-template/auth/staff-credentials";
import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

/** Offline PIN switch-in crypto, a contract with the web client: see restaurant.md#offline-pin. */

/** scrypt parameters the client must use on the PIN and the salt returned with each member. */
export const OFFLINE_PIN_KDF = { kdf: "scrypt", ...PIN_KDF_PARAMS } as const;

/** How long a device should trust material before fetching it again (a hint, see the docs). */
export const OFFLINE_MATERIAL_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const KEY_CONTEXT = "restack:offline-key:v1:";
const NONCE_BYTES = 12;
const TAG_BYTES = 16;

export type OfflineKeyScope = {
  organizationId: string;
  locationId: string;
  memberId: string;
  /** The Staff member whose session fetched and later syncs the material (the shared device's login). */
  binding: string;
  epoch: number;
};

/** `HMAC-SHA256(serverSecret, context || JSON([org, location, member, binding, epoch]))`. */
export function deriveOfflineKey(secret: string, scope: OfflineKeyScope): Buffer {
  const digest = createHmac("sha256", secret)
    .update(KEY_CONTEXT)
    .update(
      JSON.stringify([
        scope.organizationId,
        scope.locationId,
        scope.memberId,
        scope.binding,
        scope.epoch,
      ]),
    )
    .digest();
  return Buffer.from(digest);
}

/** The AES-GCM associated data that ties a sealed key to its member, Location and epoch. */
export function sealAad(
  scope: Pick<OfflineKeyScope, "organizationId" | "locationId" | "memberId" | "epoch">,
) {
  return JSON.stringify([scope.organizationId, scope.locationId, scope.memberId, scope.epoch]);
}

/** AES-256-GCM of the offline key under the PIN's scrypt key: `base64url(nonce12 || ct32 || tag16)`. */
export function sealOfflineKey(pinKey: Buffer, offlineKey: Buffer, aad: string): string {
  const nonce = randomBytes(NONCE_BYTES);
  const cipher = createCipheriv("aes-256-gcm", pinKey, nonce);
  cipher.setAAD(Buffer.from(aad));
  const body = Buffer.concat([cipher.update(offlineKey), cipher.final()]);
  return Buffer.concat([nonce, body, cipher.getAuthTag()]).toString("base64url");
}

/** Reference of what the client does: the offline key, or null for a wrong PIN or tampering. */
export function openSealedKey(pinKey: Buffer, sealed: string, aad: string): Buffer | null {
  const raw = Buffer.from(sealed, "base64url");
  if (raw.length <= NONCE_BYTES + TAG_BYTES) {
    return null;
  }
  try {
    const decipher = createDecipheriv("aes-256-gcm", pinKey, raw.subarray(0, NONCE_BYTES));
    decipher.setAAD(Buffer.from(aad));
    decipher.setAuthTag(raw.subarray(raw.length - TAG_BYTES));
    return Buffer.from(
      Buffer.concat([
        decipher.update(raw.subarray(NONCE_BYTES, raw.length - TAG_BYTES)),
        decipher.final(),
      ]),
    );
  } catch {
    return null;
  }
}

export type OfflineMacInput = {
  idempotencyKey: string;
  kind: string;
  /** The record's `deviceRecordedAt` as epoch milliseconds, exactly as the device sends it. */
  deviceRecordedAtMs: number;
};

/** `base64url(HMAC-SHA256(offlineKey, JSON([idempotencyKey, kind, deviceRecordedAtMs])))`. */
export function offlineMacOf(offlineKey: Buffer, input: OfflineMacInput): string {
  return createHmac("sha256", offlineKey)
    .update(JSON.stringify([input.idempotencyKey, input.kind, input.deviceRecordedAtMs]))
    .digest("base64url");
}

/** Constant-time check of a record's mac; a malformed mac is simply false. */
export function verifyOfflineMac(offlineKey: Buffer, input: OfflineMacInput, mac: string): boolean {
  const expected = Buffer.from(offlineMacOf(offlineKey, input));
  const given = Buffer.from(mac);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
