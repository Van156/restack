import { createListInput } from "@base-template/api/lib/list-input";
import { orgMembersListConfig } from "@base-template/api/lib/members-list-config";
import { describe, expect, test } from "bun:test";

import {
  membersListInput,
  membersSearchConfig,
  membersSearchDefaults,
  membersSearchSchema,
  toMembersListInput,
} from "./members-search";

describe("members search config", () => {
  test("sortable and filterable ids mirror the server allowlists", () => {
    expect([...membersSearchConfig.columnIds]).toEqual([...orgMembersListConfig.sortableColumns]);
    expect([...membersSearchConfig.filterableColumnIds].sort() as string[]).toEqual(
      Object.keys(orgMembersListConfig.filterableColumns).sort(),
    );
  });

  test("defaults: oldest member first, 20 per page, no filters", () => {
    expect(membersSearchDefaults).toEqual({
      page: 1,
      perPage: 20,
      sort: [{ id: "createdAt", desc: false }],
      filters: [],
      joinOperator: "and",
    });
  });
});

describe("membersSearchSchema", () => {
  test("keeps name, email and role filters with sort and paging", () => {
    const search = membersSearchSchema.parse({
      name: "ada",
      email: "example.com",
      role: "admin",
      sort: [{ id: "name", desc: true }],
      page: 2,
      perPage: 50,
    });
    expect(search).toMatchObject({
      name: "ada",
      email: "example.com",
      role: "admin",
      sort: [{ id: "name", desc: true }],
      page: 2,
      perPage: 50,
    });
  });

  test("falls back to the default sort for a column the list cannot sort by", () => {
    const search = membersSearchSchema.parse({ sort: [{ id: "userId", desc: false }] });
    expect(search.sort).toEqual([{ id: "createdAt", desc: false }]);
  });

  test("keeps up to three sort columns and drops advanced filters", () => {
    const search = membersSearchSchema.parse({
      sort: [
        { id: "role", desc: true },
        { id: "name", desc: false },
        { id: "email", desc: false },
      ],
      filters: [{ id: "role", value: "x", variant: "select", operator: "eq", filterId: "f1" }],
      joinOperator: "or",
    });
    expect(search.sort).toEqual([
      { id: "role", desc: true },
      { id: "name", desc: false },
      { id: "email", desc: false },
    ]);
    expect(search.filters).toEqual([]);
    expect(search.joinOperator).toBe("and");
  });

  test("drops a blank value and one longer than the list input accepts", () => {
    expect(membersSearchSchema.parse({ role: "" })).not.toHaveProperty("role");
    expect(membersSearchSchema.parse({ name: "" })).not.toHaveProperty("name");
    expect(membersSearchSchema.parse({ email: "x".repeat(257) })).not.toHaveProperty("email");
  });
});

describe("toMembersListInput", () => {
  test("maps the default view to a paged, sorted input without filters", () => {
    expect(toMembersListInput(membersSearchDefaults)).toEqual({
      page: 1,
      perPage: 20,
      sort: [{ id: "createdAt", desc: false }],
      filters: [],
      joinOperator: "and",
    });
  });

  test("maps simple filters to list filters the server accepts", () => {
    const input = toMembersListInput(
      membersSearchSchema.parse({ name: "ada", role: "admin", page: 3, perPage: 10 }),
    );
    expect(input.page).toBe(3);
    expect(input.perPage).toBe(10);
    expect((input.filters ?? []).map((item) => [item.id, item.operator, item.value])).toEqual([
      ["name", "iLike", "ada"],
      ["role", "eq", "admin"],
    ]);
    expect(membersListInput.safeParse(input).success).toBe(true);
    expect(createListInput(orgMembersListConfig).safeParse(input).success).toBe(true);
  });

  test("an unsorted table sends no sort", () => {
    expect(toMembersListInput(membersSearchSchema.parse({ sort: [] })).sort).toEqual([]);
  });
});
