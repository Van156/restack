import { betterAuthErrorCode, isInvitationRecipientMismatchError } from "@/features/auth";

/** R2.3, R2.5, R2.6: states of the signed-in accept-invitation flow. */
export type AcceptInvitationErrorState = "mismatch" | "not-found" | "unknown";

/**
 * Maps an accept-invitation error to a UI state. Expired, cancelled and accepted invitations (R2.6)
 * all return one generic `BAD_REQUEST`, and
 * `getInvitation`'s version carries no `code` (better-auth 1.7.5), so HTTP 400 also maps to not-found.
 */
export function resolveAcceptInvitationErrorState(error: unknown): AcceptInvitationErrorState {
  if (isInvitationRecipientMismatchError(error)) {
    return "mismatch";
  }
  if (betterAuthErrorCode(error) === "INVITATION_NOT_FOUND") {
    return "not-found";
  }
  const status = (error as { status?: number } | null | undefined)?.status;
  if (status === 400) {
    return "not-found";
  }
  return "unknown";
}

/** R2.4: states of the signed-out `POST /invitation/sign-up` flow. */
export type InvitationSignUpErrorState = "already-registered" | "invalid-or-expired" | "unknown";

export function resolveInvitationSignUpErrorState(error: unknown): InvitationSignUpErrorState {
  const code = betterAuthErrorCode(error);
  if (code === "INVITATION_EMAIL_ALREADY_REGISTERED") {
    return "already-registered";
  }
  if (code === "INVITATION_NOT_FOUND" || code === "INVALID_INVITATION_TOKEN") {
    return "invalid-or-expired";
  }
  return "unknown";
}
