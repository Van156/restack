import { confirmFor } from "@/shared/lib/confirm";

/**
 * `ConfirmDialog` props for deleting a custom role. `remove` must reject on
 * failure (`mutateAsync`) so the dialog stays open; the caller already
 * reports errors (R4.6: the server refuses while the role is still assigned).
 */
export function getDeleteRoleDialog(
  roleName: string | null,
  remove: (roleName: string) => Promise<void>,
) {
  return {
    title: "Delete role?",
    description: roleName ? `The role "${roleName}" will be permanently deleted.` : undefined,
    confirmLabel: "Delete role",
    cancelLabel: "Keep role",
    onConfirm: confirmFor(roleName, remove),
  };
}
