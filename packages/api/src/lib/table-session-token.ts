import { createHmac, timingSafeEqual } from "node:crypto";

/** How long a QR token works unless the Bill settles or the QR is regenerated first. */
export const TABLE_SESSION_TOKEN_TTL_HOURS = 12;

const HOUR_MS = 60 * 60 * 1000;
/** Domain separation: the same server secret signs other tokens, never confuse their signatures. */
const SIGNING_CONTEXT = "restack:table-session-token:v1:";

export type TableSessionTokenClaims = {
  organizationId: string;
  locationId: string;
  tableSessionId: string;
  /** `table_session.token_version` when signed; a regenerated QR makes older versions stale. */
  version: number;
};

export type TableSessionTokenVerdict =
  | { ok: true; claims: TableSessionTokenClaims & { expiresAt: Date } }
  | { ok: false; reason: "malformed" | "expired" };

function sign(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(SIGNING_CONTEXT).update(payload).digest("base64url");
}

/**
 * Signs the token the Table session QR encodes: identifiers, QR version and expiry only, no
 * personal data. See docs/architecture/restaurant.md#waiter-call.
 */
export function signTableSessionToken(
  secret: string,
  claims: TableSessionTokenClaims,
  now: Date,
): { token: string; expiresAt: Date } {
  const expiresAt = new Date(now.getTime() + TABLE_SESSION_TOKEN_TTL_HOURS * HOUR_MS);
  const payload = Buffer.from(
    JSON.stringify({
      o: claims.organizationId,
      l: claims.locationId,
      s: claims.tableSessionId,
      v: claims.version,
      e: expiresAt.getTime(),
    }),
  ).toString("base64url");
  return { token: `${payload}.${sign(secret, payload)}`, expiresAt };
}

/** Checks signature (constant time) and expiry; never throws on bad input. */
export function verifyTableSessionToken(
  secret: string,
  token: string,
  now: Date,
): TableSessionTokenVerdict {
  const malformed = { ok: false, reason: "malformed" } as const;
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return malformed;
  }
  const [payload, signature] = parts as [string, string];
  const expected = Buffer.from(sign(secret, payload));
  const given = Buffer.from(signature);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return malformed;
  }
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Record<
      string,
      unknown
    >;
    if (
      typeof data.o !== "string" ||
      typeof data.l !== "string" ||
      typeof data.s !== "string" ||
      typeof data.v !== "number" ||
      typeof data.e !== "number"
    ) {
      return malformed;
    }
    if (data.e <= now.getTime()) {
      return { ok: false, reason: "expired" };
    }
    return {
      ok: true,
      claims: {
        organizationId: data.o,
        locationId: data.l,
        tableSessionId: data.s,
        version: data.v,
        expiresAt: new Date(data.e),
      },
    };
  } catch {
    return malformed;
  }
}
