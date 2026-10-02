import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { SimpleListTable } from "@/shared/components/data-table/simple-list-table";

import { membersSearchConfig, membersSearchSchema } from "../lib/members-search";
import { getMemberRoleOptions, getMembersColumns } from "./members-columns";
import type { MembersColumnsContext, MembersTableRow } from "./members-columns";

const members: MembersTableRow[] = [
  {
    id: "m1",
    userId: "u1",
    role: "owner",
    createdAt: new Date("2026-01-02T00:00:00Z"),
    user: { name: "Ada", email: "ada@example.com" },
  },
  {
    id: "m2",
    userId: "u2",
    role: "member",
    createdAt: new Date("2026-01-03T00:00:00Z"),
    user: { name: "Bo", email: "bo@example.com" },
  },
];

const assignable = [
  { name: "admin", permission: {}, builtIn: true },
  { name: "member", permission: {}, builtIn: true },
];

const context = (overrides: Partial<MembersColumnsContext> = {}): MembersColumnsContext => ({
  roleOptions: [
    { label: "admin", value: "admin" },
    { label: "member", value: "member" },
  ],
  assignableRoles: assignable,
  canUpdateRole: true,
  canRemove: true,
  currentUserId: "u1",
  roleChangePendingId: undefined,
  removePendingId: undefined,
  onChangeRole: () => {},
  onRemove: () => {},
  ...overrides,
});

function render(overrides: Partial<MembersColumnsContext> = {}, search: unknown = {}) {
  return renderToStaticMarkup(
    <SimpleListTable
      search={membersSearchSchema.parse(search)}
      searchConfig={membersSearchConfig}
      onSearchChange={() => {}}
      columns={getMembersColumns(context(overrides))}
      emptyTitle="No members found."
      list={{
        rows: members,
        total: members.length,
        isPending: false,
        isFetching: false,
        isPlaceholderData: false,
        errorMessage: null,
        onRetry: () => {},
      }}
    />,
  );
}

/** The aria-labels of the role selects that carry the `disabled` attribute (not a `disabled:` class). */
function disabledRoleSelects(html: string): string[] {
  return [...html.matchAll(/<select aria-label="([^"]*)"[^>]*\sdisabled=""/g)].map(
    (match) => match[1] ?? "",
  );
}

describe("members columns", () => {
  const columns = getMembersColumns(context());

  test("sortable and filterable columns are the ones the server list accepts", () => {
    const sortable = columns.filter((column) => column.enableSorting !== false).map((c) => c.id);
    expect(sortable).toEqual([...membersSearchConfig.columnIds]);
    const filterable = columns.filter((column) => column.enableColumnFilter).map((c) => c.id);
    expect(filterable).toEqual([...membersSearchConfig.filterableColumnIds]);
  });

  test("the role filter offers the organization's roles", () => {
    const role = columns.find((column) => column.id === "role");
    expect(role?.meta?.options).toEqual([
      { label: "admin", value: "admin" },
      { label: "member", value: "member" },
    ]);
  });
});

describe("getMemberRoleOptions", () => {
  test("lists the assignable roles when the member's role is one of them", () => {
    expect(getMemberRoleOptions(assignable, "member").map((role) => role.name)).toEqual([
      "admin",
      "member",
    ]);
  });

  test("puts the member's own role first when the caller cannot assign it", () => {
    expect(getMemberRoleOptions(assignable, "owner").map((role) => role.name)).toEqual([
      "owner",
      "admin",
      "member",
    ]);
  });
});

describe("SimpleListTable (members)", () => {
  test("renders name, email, role and the joined date", () => {
    const html = render();
    expect(html).toContain("Ada");
    expect(html).toContain("bo@example.com");
    expect(html).toContain("Joined");
  });

  test("shows a role select only to callers who can update roles", () => {
    expect(render()).toContain("<select");
    expect(render({ canUpdateRole: false })).not.toContain("<select");
    expect(render({ assignableRoles: [] })).not.toContain("<select");
  });

  test("keeps the current role as an option the caller cannot assign", () => {
    const html = render();
    expect(html).toContain('<option value="owner"');
  });

  test("shows Remove only with member:delete and never on the caller's own row", () => {
    const withRemove = render();
    expect(withRemove.match(/Remove/g)).toHaveLength(1);
    expect(render({ canRemove: false })).not.toContain("Remove");
  });

  test("shows the pending state of a removal and disables a role change in flight", () => {
    expect(render({ removePendingId: "m2" })).toContain("Removing...");
    expect(disabledRoleSelects(render({ roleChangePendingId: "m1" }))).toEqual(["Role of Ada"]);
    expect(disabledRoleSelects(render({ roleChangePendingId: "m2" }))).toEqual(["Role of Bo"]);
    expect(disabledRoleSelects(render())).toEqual([]);
  });

  test("shows the name, email and role filters in the toolbar", () => {
    const html = render();
    const toolbar = html.slice(html.indexOf('aria-label="Table filters"'));
    expect(toolbar).toContain("Search name...");
    expect(toolbar).toContain("Search email...");
    expect(toolbar).toMatch(/data-slot="popover-trigger"[^>]*>(?:<svg.*?<\/svg>)?Role</);
  });

  test("shows a sorted header", () => {
    const html = render({}, { sort: [{ id: "name", desc: false }] });
    expect(html).toContain('aria-sort="ascending"');
  });
});
