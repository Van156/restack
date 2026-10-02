import { isCannotRevokeCurrentSessionError, revokeSessionErrorMessage } from "./security-errors";

/** What the sessions section does after a single-session revoke settles. */
export type RevokeOutcome = {
  toast: { kind: "success" | "error"; message: string };
  /**
   * Whether the confirm dialog stays open. A failed revoke keeps it open so the user can retry; a
   * stale-list refusal (the row is the current session) closes it, because retrying cannot succeed.
   */
  keepDialogOpen: boolean;
};

/**
 * Maps the result of `revokeSession` to the UI reaction. `failure` is the thrown error, or
 * `undefined` on success. The list and security log are refetched in every case.
 */
export function resolveRevokeOutcome(failure: unknown): RevokeOutcome {
  if (failure === undefined) {
    return { toast: { kind: "success", message: "Session signed out" }, keepDialogOpen: false };
  }
  return {
    toast: { kind: "error", message: revokeSessionErrorMessage(failure) },
    keepDialogOpen: !isCannotRevokeCurrentSessionError(failure),
  };
}
