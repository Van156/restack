/**
 * Pure readers for a better-auth client error (`@better-fetch/fetch` 1.3.2, better-auth 1.7.5): a
 * failed call resolves to `{ data: null, error }` where `error` is a flat object (the API body
 * plus `status`/`statusText`). Only such objects (numeric `status`) are read; thrown `Error`s
 * (network failures, `ORPCError`) never are, so callers show their own safe fallback.
 */

export type BetterAuthErrorBody = {
  code?: string;
  message?: string;
  status?: number;
  statusText?: string;
};

/** The flat client error object, or `undefined` for non-objects, thrown `Error`s and objects without a numeric `status`. */
export function betterAuthErrorBody(error: unknown): BetterAuthErrorBody | undefined {
  if (!error || typeof error !== "object" || error instanceof Error) {
    return undefined;
  }
  if (typeof (error as { status?: unknown }).status !== "number") {
    return undefined;
  }
  return error as BetterAuthErrorBody;
}

/** The API's own error `code` (e.g. `"ORGANIZATION_SLUG_ALREADY_TAKEN"`), or `undefined`. */
export function betterAuthErrorCode(error: unknown): string | undefined {
  const code = betterAuthErrorBody(error)?.code;
  return typeof code === "string" ? code : undefined;
}

/** The API's own human-readable message, then the HTTP status text, then `fallback`. */
export function betterAuthErrorMessage(error: unknown, fallback: string): string {
  const body = betterAuthErrorBody(error);
  const message = typeof body?.message === "string" ? body.message : "";
  const statusText = typeof body?.statusText === "string" ? body.statusText : "";
  return message || statusText || fallback;
}

/** R2.5: the signed-in user's email does not match the invitation's recipient. */
export function isInvitationRecipientMismatchError(error: unknown): boolean {
  return betterAuthErrorCode(error) === "YOU_ARE_NOT_THE_RECIPIENT_OF_THE_INVITATION";
}

/** R2.4: an account already exists for the invited email (sign-up-via-invitation only). */
export function isInvitationEmailAlreadyRegisteredError(error: unknown): boolean {
  return betterAuthErrorCode(error) === "INVITATION_EMAIL_ALREADY_REGISTERED";
}
