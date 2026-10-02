import { Button } from "@base-template/ui/components/button";

import type { DataTableColumnDef } from "@/shared/lib/data-table/features";
import type { Option } from "@/shared/lib/data-table/types";

import { DataTableColumnHeader } from "@/shared/components/data-table/data-table-column-header";

import type { InvitationRow } from "../types";

type InvitationsColumn = DataTableColumnDef<InvitationRow, string>;

/** What the invitation columns need from the table: filter options, the pending flags and the actions. */
export type InvitationsColumnsContext = {
  roleOptions: Option[];
  isResending: boolean;
  isCancelling: boolean;
  onResend: (invitation: InvitationRow) => void;
  /** Asks for confirmation; the invitation is only cancelled once confirmed. */
  onCancel: (invitation: InvitationRow) => void;
};

/**
 * Columns of the pending invitations table: email, role and expiry sort and the email and role
 * filter in the toolbar (client-side, see `invitations-list.ts`); Resend and Cancel are the
 * row actions.
 */
export function getInvitationsColumns({
  roleOptions,
  isResending,
  isCancelling,
  onResend,
  onCancel,
}: InvitationsColumnsContext): InvitationsColumn[] {
  return [
    {
      id: "email",
      accessorKey: "email",
      header: ({ column }) => <DataTableColumnHeader column={column} label="Email" />,
      meta: { label: "Email", placeholder: "Search email...", variant: "text" },
      enableColumnFilter: true,
    },
    {
      id: "role",
      accessorKey: "role",
      header: ({ column }) => <DataTableColumnHeader column={column} label="Role" />,
      meta: { label: "Role", variant: "select", options: roleOptions },
      enableColumnFilter: true,
    },
    {
      id: "expiresAt",
      accessorFn: (invitation) => new Date(invitation.expiresAt).toISOString(),
      header: ({ column }) => <DataTableColumnHeader column={column} label="Expires" />,
      cell: ({ row }) => (
        <span className="whitespace-nowrap text-muted-foreground">
          {new Date(row.original.expiresAt).toLocaleDateString()}
        </span>
      ),
      meta: { label: "Expires", variant: "date" },
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => (
        <div className="text-right whitespace-nowrap">
          <Button
            variant="outline"
            size="sm"
            className="mr-2"
            disabled={isResending}
            onClick={() => onResend(row.original)}
          >
            Resend
          </Button>
          <Button
            variant="destructive"
            size="sm"
            disabled={isCancelling}
            onClick={() => onCancel(row.original)}
          >
            Cancel
          </Button>
        </div>
      ),
      meta: { label: "Actions" },
      enableSorting: false,
      enableHiding: false,
    },
  ];
}
