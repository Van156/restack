import { betterAuthErrorCode } from "./auth-errors";

/**
 * R3.3: `resetPassword` answers 400 `INVALID_TOKEN` (better-auth 1.7.5) when the token is unknown,
 * expired or already used; only that error means the link is dead. Rate limits (429), server
 * errors, validation errors and network failures are retryable and stay inline.
 */
export function isInvalidResetTokenError(error: unknown): boolean {
  return betterAuthErrorCode(error) === "INVALID_TOKEN";
}
