import { PLATFORM_ROLE_NAMES, USER_STATUSES } from "@base-template/api/lib/platform-list-config";
import { Badge } from "@base-template/ui/components/badge";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import type { DataTableColumnDef } from "@/shared/lib/data-table/features";
import type { Option } from "@/shared/lib/data-table/types";

import { DataTableColumnHeader } from "@/shared/components/data-table/data-table-column-header";

/** A listed user (the fields of `platform.users.list` the table shows). */
export type UsersTableRow = {
  id: string;
  email: string;
  name: string;
  role: string | null;
  banned: boolean | null;
  createdAt: Date | string;
};

type UsersColumn = DataTableColumnDef<UsersTableRow, string>;

const ROLE_LABELS: Record<(typeof PLATFORM_ROLE_NAMES)[number], string> = {
  superadmin: "Superadmin",
  user: "User",
};

const STATUS_LABELS: Record<(typeof USER_STATUSES)[number], string> = {
  active: "Active",
  banned: "Banned",
};

const STATUS_VARIANTS: Record<(typeof USER_STATUSES)[number], "success" | "destructive"> = {
  active: "success",
  banned: "destructive",
};

const ROLE_OPTIONS: Option[] = PLATFORM_ROLE_NAMES.map((value) => ({
  label: ROLE_LABELS[value],
  value,
}));
const STATUS_OPTIONS: Option[] = USER_STATUSES.map((value) => ({
  label: STATUS_LABELS[value],
  value,
}));

type UserLinkProps = { id: string; children: ReactNode };

/** Link to the user's detail page (`/admin/users/$id`). */
function UserDetailLink({ id, children }: UserLinkProps) {
  return (
    <Link to="/admin/users/$id" params={{ id }} className="underline underline-offset-2">
      {children}
    </Link>
  );
}

/**
 * Columns of the users table. Ids are the server's list ids (`platformUsersListConfig`).
 *
 * `UserLink` renders the email cell's link; it defaults to the router link and exists so the
 * table can be rendered without a router (tests).
 */
export function getUsersColumns({
  UserLink = UserDetailLink,
}: { UserLink?: (props: UserLinkProps) => ReactNode } = {}): UsersColumn[] {
  return [
    {
      id: "email",
      accessorKey: "email",
      header: ({ column }) => <DataTableColumnHeader column={column} label="Email" />,
      cell: ({ row }) => <UserLink id={row.original.id}>{row.original.email}</UserLink>,
      meta: { label: "Email", placeholder: "Search email...", variant: "text" },
      enableColumnFilter: true,
    },
    {
      id: "name",
      accessorKey: "name",
      header: ({ column }) => <DataTableColumnHeader column={column} label="Name" />,
      cell: ({ row }) => <span className="text-muted-foreground">{row.original.name}</span>,
      meta: { label: "Name", placeholder: "Search name...", variant: "text" },
      enableColumnFilter: true,
    },
    {
      id: "role",
      accessorKey: "role",
      header: ({ column }) => <DataTableColumnHeader column={column} label="Role" />,
      cell: ({ row }) => row.original.role ?? "—",
      meta: { label: "Role", variant: "select", options: ROLE_OPTIONS },
      enableColumnFilter: true,
    },
    {
      id: "status",
      accessorFn: (row) => (row.banned ? "banned" : "active"),
      header: ({ column }) => <DataTableColumnHeader column={column} label="Status" />,
      cell: ({ row }) => {
        const status = row.original.banned ? "banned" : "active";
        return <Badge variant={STATUS_VARIANTS[status]}>{STATUS_LABELS[status]}</Badge>;
      },
      meta: { label: "Status", variant: "select", options: STATUS_OPTIONS },
      enableColumnFilter: true,
      enableSorting: false,
    },
    {
      id: "createdAt",
      accessorFn: (row) => new Date(row.createdAt).toISOString(),
      header: ({ column }) => <DataTableColumnHeader column={column} label="Created" />,
      cell: ({ row }) => (
        <span className="whitespace-nowrap text-muted-foreground">
          {new Date(row.original.createdAt).toLocaleDateString()}
        </span>
      ),
      meta: { label: "Created", variant: "date" },
    },
  ];
}
