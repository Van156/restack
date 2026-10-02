export type BanExpiryResult =
  | { type: "never" }
  | { type: "expires"; seconds: number }
  | { type: "invalid"; message: string };

/** The ban form's optional expiry (R6.3): a `datetime-local` value to the `expiresInSeconds` `users.ban` expects. `now` is injectable for tests. */
export function resolveBanExpiry(expiresAtLocal: string, now: Date): BanExpiryResult {
  if (!expiresAtLocal) {
    return { type: "never" };
  }
  const target = new Date(expiresAtLocal);
  if (Number.isNaN(target.getTime())) {
    return { type: "invalid", message: "Enter a valid date and time." };
  }
  const diffMs = target.getTime() - now.getTime();
  if (diffMs <= 0) {
    return { type: "invalid", message: "The expiry must be in the future." };
  }
  return { type: "expires", seconds: Math.round(diffMs / 1000) };
}
