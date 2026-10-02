import { betterAuthErrorMessage } from "./auth-errors";

export const SIGN_OUT_FALLBACK_MESSAGE = "Could not sign out.";

/**
 * Signs the user out and only runs `onSignedOut` (navigation) on success.
 * Both an HTTP error result and a rejected promise (network/offline) surface
 * through `showError` and leave the session UI untouched. Resolves `true` on success.
 */
export async function handleSignOut({
  signOut,
  onSignedOut,
  showError,
}: {
  signOut: () => Promise<{ error?: unknown } | undefined>;
  onSignedOut: () => void;
  showError: (message: string) => void;
}): Promise<boolean> {
  try {
    const result = await signOut();
    if (result?.error) {
      showError(betterAuthErrorMessage(result.error, SIGN_OUT_FALLBACK_MESSAGE));
      return false;
    }
  } catch {
    showError(SIGN_OUT_FALLBACK_MESSAGE);
    return false;
  }
  onSignedOut();
  return true;
}
