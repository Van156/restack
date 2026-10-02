import type { DataTableColumnDef } from "@/shared/lib/data-table/features";
import type { Option } from "@/shared/lib/data-table/types";

import {
  AUDIT_SCOPES,
  ORG_LOG_ACTIONS,
  PLATFORM_LOG_ACTIONS,
  USER_LOG_ACTIONS,
} from "@base-template/api/lib/audit-list-config";

import { DataTableColumnHeader } from "@/shared/components/data-table/data-table-column-header";
import { getDataTableSelectColumn } from "@/shared/components/data-table/data-table-select-column";

import type { AuditCsvRow, UserAuditCsvRow } from "../lib/audit-log-export";

import {
  formatAuditAction,
  formatAuditTarget,
  formatUserAuditAction,
  formatUserAuditDetail,
  getActorOptions,
  resolveActorLabel,
} from "../lib/audit-log-display";
import type { ActorRef } from "../lib/audit-log-display";

/** A listed audit row (the shape both list procedures return). */
export type AuditLogTableRow = AuditCsvRow & { id: string };

/** A listed security log row (`audit.listSelf`): `metadata` feeds the detail column. */
export type UserAuditLogRow = UserAuditCsvRow & { id: string };

type AuditColumn = DataTableColumnDef<AuditLogTableRow, string>;
type UserAuditColumn = DataTableColumnDef<UserAuditLogRow, string>;

const SCOPE_LABELS: Record<(typeof AUDIT_SCOPES)[number], string> = {
  organization: "Organization",
  platform: "Platform",
};

const toActionOptions = (actions: readonly string[]): Option[] =>
  actions.map((value) => ({ label: formatAuditAction(value), value }));

const selectColumn = () => getDataTableSelectColumn<AuditLogTableRow>() as AuditColumn;

const whenColumn = (): AuditColumn => ({
  id: "createdAt",
  accessorFn: (row) => new Date(row.createdAt).toISOString(),
  header: ({ column }) => <DataTableColumnHeader column={column} label="When" />,
  cell: ({ row }) => (
    <span className="whitespace-nowrap text-muted-foreground">
      {new Date(row.original.createdAt).toLocaleString()}
    </span>
  ),
  meta: { label: "When", variant: "date" },
  enableColumnFilter: true,
});

const actionColumn = (actions: readonly string[]): AuditColumn => ({
  id: "action",
  accessorKey: "action",
  header: ({ column }) => <DataTableColumnHeader column={column} label="Action" />,
  cell: ({ row }) => formatAuditAction(row.original.action),
  meta: { label: "Action", variant: "select", options: toActionOptions(actions) },
  enableColumnFilter: true,
});

const targetColumn = (): AuditColumn => ({
  id: "targetType",
  accessorKey: "targetType",
  header: ({ column }) => <DataTableColumnHeader column={column} label="Target" />,
  cell: ({ row }) => (
    <span className="text-muted-foreground">{formatAuditTarget(row.original)}</span>
  ),
  meta: { label: "Target", placeholder: "Search target types...", variant: "text" },
  enableColumnFilter: true,
});

const actorColumn = ({
  members,
  variant,
}: {
  members: readonly ActorRef[];
  variant: "select" | "text";
}): AuditColumn => ({
  id: "actor",
  accessorKey: "actorUserId",
  header: ({ column }) => <DataTableColumnHeader column={column} label="Actor" />,
  cell: ({ row }) => resolveActorLabel(row.original.actorUserId, members),
  meta:
    variant === "select"
      ? { label: "Actor", variant, options: getActorOptions(members) }
      : { label: "Actor ID", placeholder: "Any actor", variant },
  enableColumnFilter: true,
  enableSorting: false,
});

/**
 * Columns of the organization log. Ids are the server's list ids (`orgAuditListConfig`); the
 * actor filter is a picker over the organization's members.
 */
export function getOrgAuditColumns(members: readonly ActorRef[]): AuditColumn[] {
  return [
    selectColumn(),
    whenColumn(),
    actorColumn({ members, variant: "select" }),
    actionColumn(ORG_LOG_ACTIONS),
    targetColumn(),
  ];
}

/**
 * Columns of the platform log (`platformAuditListConfig`). The actor and organization filters
 * are free-text ids: a platform-wide member directory would mean loading every user across
 * every tenant.
 */
export function getPlatformAuditColumns(): AuditColumn[] {
  return [
    selectColumn(),
    whenColumn(),
    {
      id: "scope",
      accessorKey: "scope",
      header: ({ column }) => <DataTableColumnHeader column={column} label="Scope" />,
      meta: {
        label: "Scope",
        variant: "select",
        options: AUDIT_SCOPES.map((value) => ({ label: SCOPE_LABELS[value], value })),
      },
      enableColumnFilter: true,
    },
    {
      id: "organization",
      accessorKey: "organizationId",
      header: ({ column }) => <DataTableColumnHeader column={column} label="Organization" />,
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.original.organizationId ?? "—"}</span>
      ),
      meta: { label: "Organization ID", placeholder: "Any organization", variant: "text" },
      enableColumnFilter: true,
      enableSorting: false,
    },
    actorColumn({ members: [], variant: "text" }),
    actionColumn(PLATFORM_LOG_ACTIONS),
    targetColumn(),
  ];
}

/**
 * Columns of a user's security log (`userAuditListConfig`): when, a labelled action and a short
 * detail read from the row's metadata. The detail is display-only (not sortable or filterable).
 * Shares the when column with the other logs; their row types are structurally compatible.
 */
export function getUserAuditColumns(): UserAuditColumn[] {
  return [
    getDataTableSelectColumn<UserAuditLogRow>() as UserAuditColumn,
    whenColumn() as UserAuditColumn,
    {
      id: "action",
      accessorKey: "action",
      header: ({ column }) => <DataTableColumnHeader column={column} label="Action" />,
      cell: ({ row }) => formatUserAuditAction(row.original.action),
      meta: {
        label: "Action",
        variant: "select",
        options: USER_LOG_ACTIONS.map((value) => ({
          label: formatUserAuditAction(value),
          value,
        })),
      },
      enableColumnFilter: true,
    },
    {
      id: "detail",
      accessorFn: (row) => formatUserAuditDetail(row) ?? "",
      header: ({ column }) => <DataTableColumnHeader column={column} label="Detail" />,
      cell: ({ row }) => (
        <span className="text-muted-foreground">{formatUserAuditDetail(row.original) ?? "—"}</span>
      ),
      meta: { label: "Detail" },
      enableSorting: false,
      enableColumnFilter: false,
    },
  ];
}
