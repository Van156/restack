import { createHmac, timingSafeEqual } from "node:crypto";

/** How long a PIN switch-in keeps attributing actions to the Staff member who entered the PIN. */
export const ACTING_TOKEN_TTL_MINUTES = 15;

const MINUTE_MS = 60 * 1000;
/** Domain separation: the same server secret signs other things, never confuse their signatures. */
const SIGNING_CONTEXT = "restack:acting-token:v1:";

export type ActingClaims = { organizationId: string; locationId: string; memberId: string };
export type VerifiedActingToken = ActingClaims & { expiresAt: Date };

function sign(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(SIGNING_CONTEXT).update(payload).digest("base64url");
}

/**
 * Signs a short-lived token that binds organization, Location, member and expiry (from the
 * injected clock). Minted by `staff.switchIn` after the PIN check; order procedures accept it to
 * attribute lines, voids and discounts to that member instead of the signed-in session's member.
 */
export function signActingToken(
  secret: string,
  claims: ActingClaims,
  now: Date,
): { token: string; expiresAt: Date } {
  const expiresAt = new Date(now.getTime() + ACTING_TOKEN_TTL_MINUTES * MINUTE_MS);
  const payload = Buffer.from(
    JSON.stringify({
      o: claims.organizationId,
      l: claims.locationId,
      m: claims.memberId,
      e: expiresAt.getTime(),
    }),
  ).toString("base64url");
  return { token: `${payload}.${sign(secret, payload)}`, expiresAt };
}

/** Returns the claims of a genuine, unexpired token, else null (never throws on bad input). */
export function verifyActingToken(
  secret: string,
  token: string,
  now: Date,
): VerifiedActingToken | null {
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return null;
  }
  const [payload, signature] = parts as [string, string];
  const expected = Buffer.from(sign(secret, payload));
  const given = Buffer.from(signature);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return null;
  }
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      o?: unknown;
      l?: unknown;
      m?: unknown;
      e?: unknown;
    };
    if (
      typeof data.o !== "string" ||
      typeof data.l !== "string" ||
      typeof data.m !== "string" ||
      typeof data.e !== "number" ||
      data.e <= now.getTime()
    ) {
      return null;
    }
    return {
      organizationId: data.o,
      locationId: data.l,
      memberId: data.m,
      expiresAt: new Date(data.e),
    };
  } catch {
    return null;
  }
}
