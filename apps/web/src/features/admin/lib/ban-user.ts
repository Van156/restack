import { confirmFor } from "@/shared/lib/confirm";

/** A validated ban waiting for the admin's confirmation. */
export type PendingBan = {
  userId: string;
  reason: string;
  expiresInSeconds?: number;
};

/**
 * `ConfirmDialog` props for banning a user (R6.3). `ban` must reject on failure
 * (`mutateAsync`) so the dialog stays open; the caller already reports errors.
 */
export function getBanUserDialog(
  pending: PendingBan | null,
  ban: (pending: PendingBan) => Promise<unknown>,
) {
  return {
    title: "Ban this user?",
    description: pending
      ? `Every session is revoked and sign-in is refused ${
          pending.expiresInSeconds === undefined ? "until unbanned" : "until the ban expires"
        }. Reason: ${pending.reason}`
      : undefined,
    confirmLabel: "Ban user",
    cancelLabel: "Cancel",
    onConfirm: confirmFor(pending, async (target) => {
      await ban(target);
    }),
  };
}
