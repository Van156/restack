import type { DataTableColumnDef } from "@/shared/lib/data-table/features";

import { DataTableColumnHeader } from "@/shared/components/data-table/data-table-column-header";

/** A listed organization (the fields of `platform.organizations.list` the table shows). */
export type OrganizationsTableRow = {
  id: string;
  name: string;
  slug: string;
  memberCount: number;
  createdAt: Date | string;
};

type OrganizationsColumn = DataTableColumnDef<OrganizationsTableRow, string>;

/**
 * Columns of the organizations table. Ids are the server's list ids
 * (`platformOrganizationsListConfig`); the member count is an aggregate, so it is neither
 * sortable nor filterable.
 */
export function getOrganizationsColumns(): OrganizationsColumn[] {
  return [
    {
      id: "name",
      accessorKey: "name",
      header: ({ column }) => <DataTableColumnHeader column={column} label="Name" />,
      meta: { label: "Name", placeholder: "Search name...", variant: "text" },
      enableColumnFilter: true,
    },
    {
      id: "slug",
      accessorKey: "slug",
      header: ({ column }) => <DataTableColumnHeader column={column} label="Slug" />,
      cell: ({ row }) => <span className="text-muted-foreground">{row.original.slug}</span>,
      meta: { label: "Slug", placeholder: "Search slug...", variant: "text" },
      enableColumnFilter: true,
    },
    {
      id: "memberCount",
      accessorKey: "memberCount",
      header: ({ column }) => <DataTableColumnHeader column={column} label="Members" />,
      meta: { label: "Members" },
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
