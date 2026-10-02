import { platformOrganizationsListConfig } from "@base-template/api/lib/platform-list-config";
import { describe, expect, test } from "bun:test";

import {
  organizationsListInput,
  organizationsSearchConfig,
  organizationsSearchDefaults,
  organizationsSearchSchema,
  toOrganizationsListInput,
} from "./organizations-search";

describe("organizations search config", () => {
  test("sortable and filterable ids mirror the server allowlists", () => {
    expect([...organizationsSearchConfig.columnIds]).toEqual([
      ...platformOrganizationsListConfig.sortableColumns,
    ]);
    expect([...organizationsSearchConfig.filterableColumnIds].sort() as string[]).toEqual(
      Object.keys(platformOrganizationsListConfig.filterableColumns).sort(),
    );
  });

  test("defaults: newest first, 20 per page", () => {
    expect(organizationsSearchDefaults).toMatchObject({
      page: 1,
      perPage: 20,
      sort: [{ id: "createdAt", desc: true }],
    });
  });
});

describe("organizationsSearchSchema and toOrganizationsListInput", () => {
  test("name and slug are independent text filters", () => {
    const search = organizationsSearchSchema.parse({ name: "acme", slug: "rock" });
    const input = toOrganizationsListInput(search);
    expect((input.filters ?? []).map((item) => [item.id, item.operator, item.value])).toEqual([
      ["name", "iLike", "acme"],
      ["slug", "iLike", "rock"],
    ]);
    expect(organizationsListInput.safeParse(input).success).toBe(true);
  });

  test("advanced filters in the URL are ignored", () => {
    const search = organizationsSearchSchema.parse({
      filters: [{ id: "name", value: "x", variant: "text", operator: "iLike", filterId: "f1" }],
    });
    expect(search.filters).toEqual([]);
  });

  test("keeps all three sortable columns the server accepts", () => {
    const search = organizationsSearchSchema.parse({
      sort: [
        { id: "name", desc: false },
        { id: "slug", desc: true },
        { id: "createdAt", desc: false },
      ],
    });
    expect(toOrganizationsListInput(search).sort?.map((item) => item.id)).toEqual([
      "name",
      "slug",
      "createdAt",
    ]);
  });

  test("caps the sort at three items: a repeated column is dropped, not sent as a fourth", () => {
    const search = organizationsSearchSchema.parse({
      sort: [
        { id: "name", desc: false },
        { id: "slug", desc: true },
        { id: "createdAt", desc: false },
        { id: "name", desc: true },
      ],
    });
    expect(search.sort.map((item) => item.id)).toEqual(["name", "slug", "createdAt"]);
    expect(toOrganizationsListInput(search).sort?.length).toBe(3);
  });
});
