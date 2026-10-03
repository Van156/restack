import { describe, expect, test } from "bun:test";

import { ACTING_TOKEN_TTL_MINUTES, signActingToken, verifyActingToken } from "./acting-token";

const SECRET = "a-32-character-long-test-secret";
const NOW = new Date("2026-10-02T15:00:00.000Z");
const claims = { organizationId: "org-1", locationId: "loc-1", memberId: "member-1" };

describe("acting token", () => {
  test("a fresh token verifies and returns what it is bound to", () => {
    const { token, expiresAt } = signActingToken(SECRET, claims, NOW);
    expect(expiresAt.getTime()).toBe(NOW.getTime() + ACTING_TOKEN_TTL_MINUTES * 60_000);
    expect(verifyActingToken(SECRET, token, NOW)).toEqual({ ...claims, expiresAt });
  });

  test("an expired token is rejected", () => {
    const { token, expiresAt } = signActingToken(SECRET, claims, NOW);
    expect(verifyActingToken(SECRET, token, new Date(expiresAt.getTime() - 1))).not.toBeNull();
    expect(verifyActingToken(SECRET, token, expiresAt)).toBeNull();
  });

  test("a token signed with another secret is rejected", () => {
    const { token } = signActingToken("another-32-character-long-secret", claims, NOW);
    expect(verifyActingToken(SECRET, token, NOW)).toBeNull();
  });

  test("a tampered payload is rejected", () => {
    const { token } = signActingToken(SECRET, claims, NOW);
    const [, signature] = token.split(".");
    const forged = Buffer.from(
      JSON.stringify({ ...claims, memberId: "member-2", exp: NOW.getTime() + 60_000 }),
    ).toString("base64url");
    expect(verifyActingToken(SECRET, `${forged}.${signature}`, NOW)).toBeNull();
  });

  test("malformed input is rejected without throwing", () => {
    for (const bad of ["", "abc", "a.b.c", ".", "e30.", "not base64.%%%"]) {
      expect(verifyActingToken(SECRET, bad, NOW)).toBeNull();
    }
  });
});
