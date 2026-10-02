import { Button } from "@base-template/ui/components/button";

import type { DataTableColumnDef } from "@/shared/lib/data-table/features";
import type { Option } from "@/shared/lib/data-table/types";

import { DataTableColumnHeader } from "@/shared/components/data-table/data-table-column-header";
import type { RoleDefinition } from "@/features/access-control";

/** A listed member (the fields of `members.list` the table shows). */
export type MembersTableRow = {
  id: string;
  userId: string;
  role: string;
  createdAt: Date | string;
  user?: { name?: string | null; email?: string | null };
};

type MembersColumn = DataTableColumnDef<MembersTableRow, string>;

/**
 * What the member columns need from the page: the caller's permissions and assignable roles
 * (so the gates stay exactly where the page evaluates them), the pending mutations, and the
 * mutation triggers. The columns hold no state of their own.
 */
export type MembersColumnsContext = {
  /** Role names an organization has (filter options). */
  roleOptions: Option[];
  assignableRoles: RoleDefinition[];
  canUpdateRole: boolean;
  canRemove: boolean;
  currentUserId: string | undefined;
  /** Member whose role change is in flight. */
  roleChangePendingId: string | undefined;
  /** Member whose removal is in flight. */
  removePendingId: string | undefined;
  onChangeRole: (member: MembersTableRow, role: string) => void;
  onRemove: (member: MembersTableRow) => void;
};

/**
 * The role options of a member's select: the roles the caller may assign, plus the member's own
 * current role when it is not one of them (e.g. viewing an "owner" as an "admin"), so the select
 * never silently misrepresents it.
 */
export function getMemberRoleOptions(
  assignable: readonly RoleDefinition[],
  currentRole: string,
): RoleDefinition[] {
  return assignable.some((role) => role.name === currentRole)
    ? [...assignable]
    : [{ name: currentRole, permission: {}, builtIn: false }, ...assignable];
}

/**
 * Columns of the members table (ids are the server's `orgMembersListConfig` ids): name, email and
 * role filter; name, email, role and joined-date sort. Role change and remove are gated by
 * `member:update` / `member:delete`, and a member cannot remove themselves.
 */
export function getMembersColumns(context: MembersColumnsContext): MembersColumn[] {
  const {
    roleOptions,
    assignableRoles,
    canUpdateRole,
    canRemove,
    currentUserId,
    roleChangePendingId,
    removePendingId,
    onChangeRole,
    onRemove,
  } = context;

  return [
    {
      id: "name",
      accessorFn: (member) => member.user?.name ?? "—",
      header: ({ column }) => <DataTableColumnHeader column={column} label="Name" />,
      meta: { label: "Name", placeholder: "Search name...", variant: "text" },
      enableColumnFilter: true,
    },
    {
      id: "email",
      accessorFn: (member) => member.user?.email ?? member.userId,
      header: ({ column }) => <DataTableColumnHeader column={column} label="Email" />,
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {row.original.user?.email ?? row.original.userId}
        </span>
      ),
      meta: { label: "Email", placeholder: "Search email...", variant: "text" },
      enableColumnFilter: true,
    },
    {
      id: "role",
      accessorKey: "role",
      header: ({ column }) => <DataTableColumnHeader column={column} label="Role" />,
      cell: ({ row }) => {
        const member = row.original;
        if (!canUpdateRole || assignableRoles.length === 0) {
          return <span>{member.role}</span>;
        }
        return (
          <select
            aria-label={`Role of ${member.user?.name || member.user?.email || member.userId}`}
            className="h-8 rounded-none border border-input bg-transparent px-2 text-xs outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30"
            value={member.role}
            disabled={roleChangePendingId === member.id}
            onChange={(event) => onChangeRole(member, event.target.value)}
          >
            {getMemberRoleOptions(assignableRoles, member.role).map((role) => (
              <option key={role.name} value={role.name}>
                {role.name}
              </option>
            ))}
          </select>
        );
      },
      meta: { label: "Role", variant: "select", options: roleOptions },
      enableColumnFilter: true,
    },
    {
      id: "createdAt",
      accessorFn: (member) => new Date(member.createdAt).toISOString(),
      header: ({ column }) => <DataTableColumnHeader column={column} label="Joined" />,
      cell: ({ row }) => (
        <span className="whitespace-nowrap text-muted-foreground">
          {new Date(row.original.createdAt).toLocaleDateString()}
        </span>
      ),
      meta: { label: "Joined", variant: "date" },
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => {
        const member = row.original;
        if (!canRemove || member.userId === currentUserId) {
          return null;
        }
        const removing = removePendingId === member.id;
        return (
          <div className="text-right">
            <Button
              variant="destructive"
              size="sm"
              disabled={removing}
              onClick={() => onRemove(member)}
            >
              {removing ? "Removing..." : "Remove"}
            </Button>
          </div>
        );
      },
      meta: { label: "Actions" },
      enableSorting: false,
      enableHiding: false,
    },
  ];
}
