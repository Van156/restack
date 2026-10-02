import { Mail } from "lucide-react";
import { useMemo, useState } from "react";

import { SimpleListTable } from "@/shared/components/data-table/simple-list-table";
import ConfirmDialog from "@/shared/components/overlays/confirm-dialog";
import { useLocalTableSearch } from "@/shared/hooks/use-local-table-search";
import { confirmFor } from "@/shared/lib/confirm";
import { applyClientList } from "@/shared/lib/data-table/client-list";

import {
  getInvitationRoleOptions,
  invitationsAccessors,
  invitationsSearchConfig,
  invitationsSearchSchema,
  toInvitationsListState,
} from "../lib/invitations-list";
import type { InvitationRow } from "../types";
import { getInvitationsColumns } from "./invitations-columns";

/**
 * Pending invitations with resend and cancel, in a client-side data table (the whole list is in
 * memory). Cancelling asks for confirmation; `onCancel` must reject on failure so the dialog
 * stays open (the caller reports the error).
 */
export default function PendingInvitationsTable({
  invitations,
  isPending,
  errorMessage,
  onRetry,
  isResending,
  isCancelling,
  onResend,
  onCancel,
}: {
  invitations: InvitationRow[];
  isPending: boolean;
  errorMessage: string | null;
  onRetry: () => void;
  isResending: boolean;
  isCancelling: boolean;
  onResend: (invitation: InvitationRow) => void;
  onCancel: (invitationId: string) => Promise<void>;
}) {
  const [invitationToCancel, setInvitationToCancel] = useState<InvitationRow | null>(null);

  const { search, onSearchChange } = useLocalTableSearch(invitationsSearchSchema);
  const { rows, total } = applyClientList(
    invitations,
    toInvitationsListState(search),
    invitationsAccessors,
  );
  const roleOptions = useMemo(() => getInvitationRoleOptions(invitations), [invitations]);
  const columns = useMemo(
    () =>
      getInvitationsColumns({
        roleOptions,
        isResending,
        isCancelling,
        onResend,
        onCancel: setInvitationToCancel,
      }),
    [roleOptions, isResending, isCancelling, onResend],
  );

  return (
    <>
      <SimpleListTable
        search={search}
        searchConfig={invitationsSearchConfig}
        onSearchChange={onSearchChange}
        columns={columns}
        emptyTitle="No pending invitations"
        emptyIcon={<Mail />}
        list={{
          rows,
          total,
          isPending,
          isFetching: false,
          isPlaceholderData: false,
          errorMessage,
          onRetry,
        }}
      />
      <ConfirmDialog
        open={invitationToCancel !== null}
        onOpenChange={(open) => {
          if (!open) {
            setInvitationToCancel(null);
          }
        }}
        title="Cancel invitation?"
        description={
          invitationToCancel
            ? `The invitation for ${invitationToCancel.email} will no longer be valid.`
            : undefined
        }
        confirmLabel="Cancel invitation"
        cancelLabel="Keep invitation"
        onConfirm={confirmFor(invitationToCancel, (invitation) => onCancel(invitation.id))}
      />
    </>
  );
}
