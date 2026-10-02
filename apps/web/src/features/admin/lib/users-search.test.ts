import { createListInput } from "@base-template/api/lib/list-input";
import { platformUsersListConfig } from "@base-template/api/lib/platform-list-config";
import { describe, expect, test } from "bun:test";

import {
  toUsersListInput,
  usersListInput,
  usersSearchConfig,
  usersSearchDefaults,
  usersSearchSchema,
} from "./users-search";

describe("users search config", () => {
  test("sortable and filterable ids mirror the server allowlists", () => {
    expect([...usersSearchConfig.columnIds]).toEqual([...platformUsersListConfig.sortableColumns]);
    expect([...usersSearchConfig.filterableColumnIds].sort() as string[]).toEqual(
      Object.keys(platformUsersListConfig.filterableColumns).sort(),
    );
  });

  test("defaults: newest first, 20 per page, no filters", () => {
    expect(usersSearchDefaults).toEqual({
      page: 1,
      perPage: 20,
      sort: [{ id: "createdAt", desc: true }],
      filters: [],
      joinOperator: "and",
    });
  });
});

describe("usersSearchSchema", () => {
  test("keeps valid simple filters, sort and paging", () => {
    const search = usersSearchSchema.parse({
      email: "ada",
      role: "superadmin",
      sort: [{ id: "email", desc: false }],
      page: 2,
      perPage: 50,
    });
    expect(search).toMatchObject({
      email: "ada",
      role: "superadmin",
      sort: [{ id: "email", desc: false }],
      page: 2,
      perPage: 50,
    });
  });

  test("drops a role or status the server would reject", () => {
    const search = usersSearchSchema.parse({ role: "root", status: "gone" });
    expect(search).not.toHaveProperty("role");
    expect(search).not.toHaveProperty("status");
  });

  test("keeps an email and a name search, and a role and a status facet, together", () => {
    const search = usersSearchSchema.parse({
      name: "bo",
      email: "ada",
      status: "banned",
      role: "user",
    });
    expect(search).toMatchObject({ name: "bo", email: "ada", status: "banned", role: "user" });
  });

  test("keeps up to three sort columns and drops advanced filters", () => {
    const search = usersSearchSchema.parse({
      sort: [
        { id: "name", desc: true },
        { id: "email", desc: false },
      ],
      filters: [{ id: "email", value: "x", variant: "text", operator: "iLike", filterId: "f1" }],
      joinOperator: "or",
    });
    expect(search.sort).toEqual([
      { id: "name", desc: true },
      { id: "email", desc: false },
    ]);
    expect(search.filters).toEqual([]);
    expect(search.joinOperator).toBe("and");
  });
});

describe("toUsersListInput", () => {
  test("maps simple filters to list filters the server accepts", () => {
    const input = toUsersListInput(
      usersSearchSchema.parse({ email: "ada", status: "banned", page: 3, perPage: 10 }),
    );
    expect(input.page).toBe(3);
    expect(input.perPage).toBe(10);
    expect(input.sort as unknown).toEqual([{ id: "createdAt", desc: true }]);
    expect((input.filters ?? []).map((item) => [item.id, item.operator, item.value])).toEqual([
      ["email", "iLike", "ada"],
      ["status", "eq", "banned"],
    ]);
    expect(usersListInput.safeParse(input).success).toBe(true);
    expect(createListInput(platformUsersListConfig).safeParse(input).success).toBe(true);
  });

  test("an unsorted table sends no sort", () => {
    const input = toUsersListInput(usersSearchSchema.parse({ sort: [] }));
    expect(input.sort).toEqual([]);
  });
});
