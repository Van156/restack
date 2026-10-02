import { betterAuthErrorMessage } from "./auth-errors";

export const AUTH_FORM_FALLBACK_MESSAGE = "Something went wrong. Please try again.";

export type AuthActionResult = { ok: true } | { ok: false; message: string };

/**
 * Runs a better-auth client call for an auth form and never throws: an HTTP
 * error result (`{ data, error }`, flat error shape) and a rejected promise
 * (network/offline) both resolve to `{ ok: false, message }` for the inline
 * `AuthFormError`, so the form stays usable.
 */
export async function runAuthAction(
  action: () => Promise<{ error?: unknown } | null | undefined>,
  fallback: string = AUTH_FORM_FALLBACK_MESSAGE,
): Promise<AuthActionResult> {
  try {
    const result = await action();
    if (result?.error) {
      return { ok: false, message: betterAuthErrorMessage(result.error, fallback) };
    }
    return { ok: true };
  } catch {
    return { ok: false, message: fallback };
  }
}
