import { betterAuthErrorCode, betterAuthErrorMessage } from "@/features/auth";

/** R3.1: a wrong current password is a field-level, user-fixable mistake; other failures use the API message. */
export function changePasswordErrorMessage(error: unknown): string {
  if (betterAuthErrorCode(error) === "INVALID_PASSWORD") {
    return "Your current password is incorrect.";
  }
  return betterAuthErrorMessage(error, "Could not change your password.");
}

/** The server refuses to revoke the session making the request (R4.2); the list is stale. */
export function isCannotRevokeCurrentSessionError(error: unknown): boolean {
  return betterAuthErrorCode(error) === "CANNOT_REVOKE_CURRENT_SESSION";
}

/** Message for a failed single-session revoke; the current-session refusal gets a specific one. */
export function revokeSessionErrorMessage(error: unknown): string {
  if (isCannotRevokeCurrentSessionError(error)) {
    return "You can't sign out the session you are using here. Use Sign out instead.";
  }
  return betterAuthErrorMessage(error, "Could not sign out that session.");
}
