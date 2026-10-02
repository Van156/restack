// Deterministic fixtures shared by the data table stories and render tests: no network, no randomness.
import { AlertCircleIcon, CheckCircle2Icon } from "lucide-react";
import { useMemo, useState } from "react";

import type { DataTableColumnDef } from "@/shared/lib/data-table/features";
import type { DataTableSearchConfig } from "@/shared/lib/data-table/search";

import { useDataTable } from "@/shared/hooks/use-data-table";
import { getPageCount } from "@/shared/lib/data-table/pagination";
import { createDataTableSearchSchema } from "@/shared/lib/data-table/search";

import { queryMembers } from "./data-table-fake-server";
import { DataTableColumnHeader } from "./data-table-column-header";
import { getDataTableSelectColumn } from "./data-table-select-column";

export type MemberRow = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "member" | "viewer";
  status: "active" | "suspended";
  score: number;
  joinedAt: number;
};

export const memberRows: MemberRow[] = [
  {
    id: "m1",
    name: "Ada Lovelace",
    email: "ada@example.com",
    role: "admin",
    status: "active",
    score: 92,
    joinedAt: Date.UTC(2024, 0, 15),
  },
  {
    id: "m2",
    name: "Grace Hopper",
    email: "grace@example.com",
    role: "member",
    status: "active",
    score: 78,
    joinedAt: Date.UTC(2024, 2, 3),
  },
  {
    id: "m3",
    name: "Alan Turing",
    email: "alan@example.com",
    role: "viewer",
    status: "suspended",
    score: 55,
    joinedAt: Date.UTC(2024, 4, 21),
  },
  {
    id: "m4",
    name: "Edsger Dijkstra",
    email: "edsger@example.com",
    role: "member",
    status: "active",
    score: 84,
    joinedAt: Date.UTC(2024, 6, 9),
  },
  {
    id: "m5",
    name: "Barbara Liskov",
    email: "barbara@example.com",
    role: "admin",
    status: "active",
    score: 97,
    joinedAt: Date.UTC(2024, 8, 30),
  },
];

export const memberSearchConfig = {
  columnIds: ["name", "email", "role", "status", "score", "joinedAt"],
  defaultSort: [{ id: "name", desc: false }],
  defaultPerPage: 10,
} as const satisfies DataTableSearchConfig<
  "name" | "email" | "role" | "status" | "score" | "joinedAt"
>;

export const memberSearchSchema = createDataTableSearchSchema(memberSearchConfig);

export const roleOptions = [
  { label: "Admin", value: "admin", count: 2 },
  { label: "Member", value: "member", count: 2 },
  { label: "Viewer", value: "viewer", count: 1 },
];

export const statusOptions = [
  { label: "Active", value: "active", icon: CheckCircle2Icon },
  { label: "Suspended", value: "suspended", icon: AlertCircleIcon },
];

export const memberColumns: DataTableColumnDef<MemberRow, string>[] = [
  getDataTableSelectColumn<MemberRow>() as DataTableColumnDef<MemberRow, string>,
  {
    id: "name",
    accessorKey: "name",
    header: ({ column }) => <DataTableColumnHeader column={column} label="Name" />,
    meta: { label: "Name", placeholder: "Search names...", variant: "text" },
    enableColumnFilter: true,
  },
  {
    id: "email",
    accessorKey: "email",
    header: ({ column }) => <DataTableColumnHeader column={column} label="Email" />,
    meta: { label: "Email" },
  },
  {
    id: "role",
    accessorKey: "role",
    header: ({ column }) => <DataTableColumnHeader column={column} label="Role" />,
    meta: { label: "Role", variant: "multiSelect", options: roleOptions },
    enableColumnFilter: true,
  },
  {
    id: "status",
    accessorKey: "status",
    header: ({ column }) => <DataTableColumnHeader column={column} label="Status" />,
    meta: { label: "Status", variant: "select", options: statusOptions },
    enableColumnFilter: true,
  },
  {
    id: "score",
    accessorKey: "score",
    header: ({ column }) => <DataTableColumnHeader column={column} label="Score" />,
    meta: { label: "Score", variant: "range", range: [0, 100], unit: "pts" },
    enableColumnFilter: true,
  },
  {
    id: "joinedAt",
    accessorFn: (row) => new Date(row.joinedAt).toISOString().slice(0, 10),
    header: ({ column }) => <DataTableColumnHeader column={column} label="Joined" />,
    meta: { label: "Joined", variant: "dateRange" },
    enableColumnFilter: true,
  },
];

const FIRST_NAMES = ["Ada", "Grace", "Alan", "Edsger", "Barbara", "Linus", "Margaret", "Dennis"];
const LAST_NAMES = [
  "Lovelace",
  "Hopper",
  "Turing",
  "Dijkstra",
  "Liskov",
  "Torvalds",
  "Hamilton",
  "Ritchie",
];
const ROLES: MemberRow["role"][] = ["admin", "member", "viewer"];

/** 47 deterministic members, enough for several pages. */
export const manyMembers: MemberRow[] = Array.from({ length: 47 }, (_, index) => {
  const first = FIRST_NAMES[index % FIRST_NAMES.length] ?? "Ada";
  const last = LAST_NAMES[(index * 3) % LAST_NAMES.length] ?? "Lovelace";
  return {
    id: `member-${index + 1}`,
    name: `${first} ${last} ${index + 1}`,
    email: `${first.toLowerCase()}.${index + 1}@example.com`,
    role: ROLES[index % ROLES.length] ?? "member",
    status: index % 5 === 0 ? "suspended" : "active",
    score: (index * 37) % 101,
    joinedAt: Date.UTC(2024, index % 12, (index % 27) + 1),
  };
});

/**
 * Story and test helper: the member table bound to in-memory search state (no router), which
 * is exactly how a feature binds it to `Route.useSearch()` and `navigate`.
 */
export function useMemberTable({
  initialSearch = {},
  source = manyMembers,
  enableRowSelection = true,
  initialRowSelection = {},
  enableAdvancedFilter = false,
}: {
  initialSearch?: unknown;
  source?: MemberRow[];
  enableRowSelection?: boolean;
  /** Advanced mode: filters and join operator live in `search.filters`/`joinOperator`. */
  enableAdvancedFilter?: boolean;
  initialRowSelection?: Record<string, true>;
} = {}) {
  const [search, setSearch] = useState(() => memberSearchSchema.parse(initialSearch));
  const { rows, total } = useMemo(() => queryMembers(source, search), [source, search]);
  const { table, advanced } = useDataTable({
    data: rows,
    columns: memberColumns,
    pageCount: getPageCount(total, search.perPage),
    getRowId: (row) => row.id,
    search,
    searchConfig: memberSearchConfig,
    onSearchChange: (next) => setSearch(memberSearchSchema.parse(next)),
    enableRowSelection,
    enableAdvancedFilter,
    initialState: {
      columnPinning: { start: ["select"], end: [] },
      rowSelection: initialRowSelection,
    },
  });
  return { table, advanced, rows, total, search };
}
