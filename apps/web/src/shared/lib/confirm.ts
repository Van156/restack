/**
 * Runs a confirm handler and reports whether it succeeded. A rejection (or a
 * sync throw) resolves to `false` instead of propagating so the dialog can
 * stay open; the handler itself owns surfacing the error (e.g. a toast). The
 * caught error is also logged so a failing handler is never fully silent.
 */
export async function settleConfirm(onConfirm: () => void | Promise<void>): Promise<boolean> {
  try {
    await onConfirm();
    return true;
  } catch (error) {
    console.error("ConfirmDialog onConfirm failed", error);
    return false;
  }
}

/**
 * Binds a confirm dialog's `onConfirm` to the item it is about. With no pending
 * target (dialog closed) confirming is a no-op; otherwise the action's result,
 * including a rejection, is passed through so `settleConfirm` can keep the
 * dialog open on failure.
 */
export function confirmFor<T>(
  target: T | null,
  action: (target: T) => void | Promise<void>,
): () => void | Promise<void> {
  return () => (target === null ? undefined : action(target));
}

/**
 * Whether `typed` is exactly `phrase`: case-sensitive, no trimming, so a destructive action that
 * asks to retype a name cannot be confirmed by a near miss. An empty phrase never matches.
 */
export function matchesConfirmationPhrase(typed: string, phrase: string): boolean {
  return phrase.length > 0 && typed === phrase;
}
