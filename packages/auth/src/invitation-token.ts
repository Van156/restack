import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Invitation accept token (R2.4): the invitation id alone does not prove inbox ownership, so a token
 * is minted on send and only its hash stored.
 * See docs/architecture/auth.md#invitation-sign-up-flow
 */

/** better-auth `verification` table identifier for one invitation's accept token. */
export function invitationSignUpIdentifier(invitationId: string): string {
  return `invitation-sign-up:${invitationId}`;
}

/** A high-entropy, URL-safe raw token (32 bytes) embedded in the accept link. */
export function generateInvitationToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Buffer.from(bytes).toString("base64url");
}

/** SHA-256 hex digest of a raw token — the only form ever written to storage. */
export function hashInvitationToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Constant-time equality between a candidate token's digest and the stored
 * digest, so a wrong invitation-sign-up token cannot be distinguished from a
 * near-miss by response timing.
 */
export function invitationTokensMatch(candidateHash: string, storedHash: string): boolean {
  const candidate = Buffer.from(candidateHash, "hex");
  const stored = Buffer.from(storedHash, "hex");
  return candidate.length === stored.length && timingSafeEqual(candidate, stored);
}
