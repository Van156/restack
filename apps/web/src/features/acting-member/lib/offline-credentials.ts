import { createJsonSlot, type SlotStorage } from "./json-slot";
import type { OfflineMaterial } from "./offline-pin-crypto";

/** The device re-fetches its material about once a day while online. */
export const CREDENTIAL_REFRESH_MS = 24 * 60 * 60 * 1000;

export type StoredCredentials = { fetchedAt: Date; members: OfflineMaterial[] };

export function credentialsKey(organizationId: string, locationId: string): string {
  return `restack:offline-pin:${organizationId}:${locationId}`;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

function parseMaterial(raw: unknown): OfflineMaterial | undefined {
  if (!isRecord(raw) || !isRecord(raw.params)) {
    return undefined;
  }
  const expiresAt = new Date(String(raw.expiresAt));
  if (
    typeof raw.memberId !== "string" ||
    typeof raw.name !== "string" ||
    typeof raw.role !== "string" ||
    typeof raw.salt !== "string" ||
    typeof raw.sealedKey !== "string" ||
    typeof raw.epoch !== "number" ||
    Number.isNaN(expiresAt.getTime())
  ) {
    return undefined;
  }
  const { kdf, N, r, p, dkLen } = raw.params;
  if (
    typeof kdf !== "string" ||
    typeof N !== "number" ||
    typeof r !== "number" ||
    typeof p !== "number" ||
    typeof dkLen !== "number"
  ) {
    return undefined;
  }
  return {
    memberId: raw.memberId,
    name: raw.name,
    role: raw.role,
    salt: raw.salt,
    params: { kdf, N, r, p, dkLen },
    sealedKey: raw.sealedKey,
    epoch: raw.epoch,
    expiresAt,
  };
}

function parseCredentials(raw: unknown): StoredCredentials | undefined {
  if (!isRecord(raw) || !Array.isArray(raw.members)) {
    return undefined;
  }
  const fetchedAt = new Date(String(raw.fetchedAt));
  const members = raw.members.map(parseMaterial);
  if (Number.isNaN(fetchedAt.getTime()) || members.some((member) => member === undefined)) {
    return undefined;
  }
  return { fetchedAt, members: members as OfflineMaterial[] };
}

/**
 * The sealed PIN material of one Location's Staff, as `staff.offlineCredentials` returned it:
 * salts and ciphertext only, never a PIN. See docs/architecture/restaurant.md#offline-pin.
 */
export function createCredentialStore(storage: SlotStorage, key: string) {
  const slot = createJsonSlot(storage, key, parseCredentials);
  return {
    read: slot.read,
    write: (credentials: StoredCredentials) => slot.write(credentials),
    clear: slot.clear,
  };
}

/** Whether to fetch again: nothing stored, a day old, or some material past its expiry hint. */
export function needsRefresh(stored: StoredCredentials | undefined, now: Date): boolean {
  if (!stored) {
    return true;
  }
  return (
    now.getTime() - stored.fetchedAt.getTime() >= CREDENTIAL_REFRESH_MS ||
    stored.members.some((member) => member.expiresAt.getTime() <= now.getTime())
  );
}

export function materialFor(
  stored: StoredCredentials | undefined,
  memberId: string,
): OfflineMaterial | undefined {
  return stored?.members.find((member) => member.memberId === memberId);
}
