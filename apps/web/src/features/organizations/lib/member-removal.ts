import { confirmFor } from "@/shared/lib/confirm";

export type RemovableMember = {
  id: string;
  userId: string;
  user?: { name?: string | null; email?: string | null };
};

/** How a member is named in the confirmation: name, else email, else the user id. */
export function memberDisplayName(member: RemovableMember): string {
  return member.user?.name || member.user?.email || member.userId;
}

/**
 * `ConfirmDialog` props for removing a member. `remove` must reject on failure
 * (`mutateAsync`) so the dialog stays open; the caller already reports errors.
 */
export function getRemoveMemberDialog(
  member: RemovableMember | null,
  remove: (memberId: string) => Promise<void>,
) {
  return {
    title: "Remove member?",
    description: member
      ? `${memberDisplayName(member)} will lose access to this organization.`
      : undefined,
    confirmLabel: "Remove member",
    cancelLabel: "Keep member",
    onConfirm: confirmFor(member, (target) => remove(target.id)),
  };
}
