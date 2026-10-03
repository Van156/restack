import { base64UrlEncode } from "@/shared/lib/base64url";

export const GUEST_ID_KEY = "restack.guest-id";

/** The slice of `Storage` the guest id needs; it may throw (private mode, blocked storage). */
export type GuestStorage = Pick<Storage, "getItem" | "setItem">;

/** The same shape the server accepts in `x-guest-id`. */
const GUEST_ID_PATTERN = /^[A-Za-z0-9_-]{16,64}$/;

/** A random, url-safe id from 16 random bytes (22 characters). */
export function newGuestId(randomBytes: (length: number) => Uint8Array): string {
  return base64UrlEncode(randomBytes(16));
}

/** Browser source of random bytes. */
export function browserRandomBytes(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length));
}

/** The guest's id on this device, stored once; when storage fails it lives for this visit only. */
export function loadOrCreateGuestId(
  storage: GuestStorage | null,
  randomBytes: (length: number) => Uint8Array = browserRandomBytes,
): string {
  try {
    const stored = storage?.getItem(GUEST_ID_KEY);
    if (stored && GUEST_ID_PATTERN.test(stored)) {
      return stored;
    }
  } catch {
    // Unreadable storage: fall through to a fresh id.
  }
  const id = newGuestId(randomBytes);
  try {
    storage?.setItem(GUEST_ID_KEY, id);
  } catch {
    // Unwritable storage: the id is kept in memory for this visit.
  }
  return id;
}
