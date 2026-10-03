import { describe, expect, test } from "bun:test";

import { signActingToken } from "./acting-token";
import {
  signTableSessionToken,
  TABLE_SESSION_TOKEN_TTL_HOURS,
  verifyTableSessionToken,
} from "./table-session-token";

const SECRET = "a-32-character-long-test-secret";
const NOW = new Date("2026-10-02T15:00:00.000Z");
const HOUR_MS = 60 * 60 * 1000;
const claims = {
  organizationId: "org-1",
  locationId: "loc-1",
  tableSessionId: "session-1",
  version: 3,
};

describe("table session token", () => {
  test("a fresh token verifies and carries exactly its claims", () => {
    const { token, expiresAt } = signTableSessionToken(SECRET, claims, NOW);
    expect(expiresAt.getTime()).toBe(NOW.getTime() + TABLE_SESSION_TOKEN_TTL_HOURS * HOUR_MS);
    expect(verifyTableSessionToken(SECRET, token, NOW)).toEqual({
      ok: true,
      claims: { ...claims, expiresAt },
    });
  });

  test("carries no personal data: only identifiers, version and expiry", () => {
    const { token } = signTableSessionToken(SECRET, claims, NOW);
    const payload = JSON.parse(Buffer.from(token.split(".")[0]!, "base64url").toString("utf8"));
    expect(Object.keys(payload).sort()).toEqual(["e", "l", "o", "s", "v"]);
  });

  test("expires at the expiry instant", () => {
    const { token, expiresAt } = signTableSessionToken(SECRET, claims, NOW);
    const justBefore = new Date(expiresAt.getTime() - 1);
    expect(verifyTableSessionToken(SECRET, token, justBefore).ok).toBe(true);
    expect(verifyTableSessionToken(SECRET, token, expiresAt)).toEqual({
      ok: false,
      reason: "expired",
    });
  });

  test("a tampered payload or signature is malformed", () => {
    const { token } = signTableSessionToken(SECRET, claims, NOW);
    const [payload, signature] = token.split(".") as [string, string];
    const forged = Buffer.from(
      JSON.stringify({ o: "org-2", l: "loc-1", s: "session-1", v: 3, e: NOW.getTime() + HOUR_MS }),
    ).toString("base64url");
    expect(verifyTableSessionToken(SECRET, `${forged}.${signature}`, NOW)).toEqual({
      ok: false,
      reason: "malformed",
    });
    expect(verifyTableSessionToken(SECRET, `${payload}.${signature}x`, NOW).ok).toBe(false);
  });

  test("another secret never verifies", () => {
    const { token } = signTableSessionToken(SECRET, claims, NOW);
    expect(verifyTableSessionToken("another-32-character-test-secret", token, NOW).ok).toBe(false);
  });

  test("garbage input never throws", () => {
    for (const garbage of ["", ".", "a.b", "a.b.c", "%%%.%%%", "e30.e30"]) {
      expect(verifyTableSessionToken(SECRET, garbage, NOW).ok).toBe(false);
    }
  });

  test("an acting token is not a Table session token", () => {
    const { token } = signActingToken(
      SECRET,
      { organizationId: "org-1", locationId: "loc-1", memberId: "m-1" },
      NOW,
    );
    expect(verifyTableSessionToken(SECRET, token, NOW).ok).toBe(false);
  });
});
