import {
  orgAuditListConfig,
  platformAuditListConfig,
  userAuditListConfig,
} from "@base-template/api/lib/audit-list-config";
import { createListInput } from "@base-template/api/lib/list-input";
import { describe, expect, test } from "bun:test";

import {
  createUserAuditTabSearchSchema,
  orgAuditListInput,
  orgAuditSearchConfig,
  orgAuditSearchDefaults,
  orgAuditSearchSchema,
  platformAuditListInput,
  platformAuditSearchConfig,
  platformAuditSearchDefaults,
  platformAuditSearchSchema,
  toOrgAuditListInput,
  toPlatformAuditListInput,
  toUserAuditListInput,
  userAuditSearchConfig,
  userAuditSearchDefaults,
  userAuditSearchSchema,
} from "./audit-log-search";

const filter = (overrides: Record<string, unknown> = {}) => ({
  id: "action",
  value: "member.added",
  variant: "select",
  operator: "eq",
  filterId: "filter-1",
  ...overrides,
});

describe("audit log search configs", () => {
  test("sortable and filterable ids mirror the server allowlists", () => {
    expect([...orgAuditSearchConfig.columnIds] as string[]).toEqual([
      ...orgAuditListConfig.sortableColumns,
    ]);
    expect([...(orgAuditSearchConfig.filterableColumnIds as readonly string[])].sort()).toEqual(
      Object.keys(orgAuditListConfig.filterableColumns).sort(),
    );
    expect([...platformAuditSearchConfig.columnIds]).toEqual([
      ...platformAuditListConfig.sortableColumns,
    ]);
    expect(
      [...(platformAuditSearchConfig.filterableColumnIds as readonly string[])].sort(),
    ).toEqual(Object.keys(platformAuditListConfig.filterableColumns).sort());
  });

  test("default sort is newest first with 20 rows per page", () => {
    for (const config of [orgAuditSearchConfig, platformAuditSearchConfig]) {
      expect(config.defaultSort).toEqual([{ id: "createdAt", desc: true }]);
      expect(config.defaultPerPage).toBe(20);
    }
  });

  test("the list inputs are built from the same configs", () => {
    expect(orgAuditListInput.parse({}).sort).toEqual([{ id: "createdAt", desc: true }]);
    expect(createListInput(platformAuditListConfig).parse({}).perPage).toBe(
      platformAuditListInput.parse({}).perPage,
    );
  });
});

describe("audit log search defaults", () => {
  test("are the empty search's defaults, so stripping them restores a clean URL", () => {
    expect(orgAuditSearchDefaults).toEqual({
      page: 1,
      perPage: 20,
      sort: [{ id: "createdAt", desc: true }],
      filters: [],
      joinOperator: "and",
    });
    expect(platformAuditSearchDefaults).toEqual(orgAuditSearchDefaults);
  });
});

describe("audit log search schemas", () => {
  test("an empty search is the default view", () => {
    expect(orgAuditSearchSchema.parse({})).toEqual({
      page: 1,
      perPage: 20,
      sort: [{ id: "createdAt", desc: true }],
      filters: [],
      joinOperator: "and",
    });
  });

  test("a valid URL round-trips", () => {
    const search = {
      page: 2,
      perPage: 50,
      sort: [{ id: "action", desc: false }],
      filters: [filter()],
      joinOperator: "or",
    };
    expect(orgAuditSearchSchema.parse(search)).toEqual(search as never);
  });

  test("filters the server would reject are dropped, valid ones kept", () => {
    const parsed = orgAuditSearchSchema.parse({
      filters: [
        filter(),
        filter({ filterId: "filter-2", value: "not.an.action" }),
        filter({
          filterId: "filter-3",
          id: "targetType",
          variant: "number",
          operator: "eq",
          value: "1",
        }),
      ],
    });
    expect(parsed.filters.map((item) => item.filterId)).toEqual(["filter-1"]);
  });

  test("sort ids outside the sortable columns fall back to the default sort", () => {
    expect(orgAuditSearchSchema.parse({ sort: [{ id: "actor", desc: true }] }).sort).toEqual([
      { id: "createdAt", desc: true },
    ]);
  });

  test("the platform schema accepts the platform-only columns, the org schema does not", () => {
    const scope = filter({ id: "scope", value: "platform" });
    expect(platformAuditSearchSchema.parse({ filters: [scope] }).filters).toHaveLength(1);
    expect(orgAuditSearchSchema.parse({ filters: [scope] }).filters).toHaveLength(0);
    expect(platformAuditSearchSchema.parse({ sort: [{ id: "scope", desc: false }] }).sort).toEqual([
      { id: "scope", desc: false },
    ]);
  });

  test("a hand-typed junk search never throws", () => {
    for (const junk of [null, "x", 5, [], { page: "abc", filters: "{", sort: 3 }]) {
      expect(() => orgAuditSearchSchema.parse(junk)).not.toThrow();
    }
  });
});

describe("toAuditListInput", () => {
  test("maps a parsed search to a server input the list procedures accept", () => {
    const search = orgAuditSearchSchema.parse({
      page: 2,
      filters: [filter()],
      sort: [{ id: "targetType", desc: false }],
    });
    const input = toOrgAuditListInput(search);
    expect(orgAuditListInput.safeParse(input).success).toBe(true);
    expect(input.page).toBe(2);
    expect(input.filters).toHaveLength(1);

    const platform = toPlatformAuditListInput(platformAuditSearchSchema.parse({ page: 3 }));
    expect(platformAuditListInput.safeParse(platform).success).toBe(true);
  });

  test("a huge page is clamped so the server accepts it", () => {
    const search = orgAuditSearchSchema.parse({ page: 10 ** 9 });
    expect(orgAuditListInput.safeParse(toOrgAuditListInput(search)).success).toBe(true);
  });
});

describe("audit date filters (local-midnight epoch ms, spec T4 contract)", () => {
  const DAY = 86_400_000;
  const midnight = new Date(2026, 0, 2).getTime();
  const date = (operator: string, value: string | string[], variant = "date") =>
    filter({ id: "createdAt", variant, operator, value });

  test("the platform and org logs accept eq, comparisons and isBetween on a day epoch", () => {
    const filters = [
      date("eq", String(midnight)),
      date("lt", String(midnight)),
      date("gte", String(midnight)),
      date("isBetween", [String(midnight), String(midnight + 2 * DAY)]),
    ];
    for (const item of filters) {
      expect(platformAuditListInput.safeParse({ filters: [item] }).success).toBe(true);
      expect(orgAuditListInput.safeParse({ filters: [item] }).success).toBe(true);
    }
  });

  test("a date filter survives validateSearch and reaches the list input unchanged", () => {
    const item = date("isBetween", [String(midnight), String(midnight + DAY)]);
    const search = platformAuditSearchSchema.parse({ filters: [item] });
    expect(toPlatformAuditListInput(search).filters as unknown).toEqual([item]);
  });

  test("a non-epoch value or a one-ended range is dropped, not sent to the server", () => {
    const bad = [
      date("eq", "yesterday"),
      date("isBetween", [String(midnight)]),
      date("isRelativeToToday", "1 days"),
    ];
    const search = platformAuditSearchSchema.parse({ filters: bad });
    expect(search.filters).toEqual([]);
  });
});

describe("user security log search", () => {
  test("sortable and filterable ids mirror the server allowlist", () => {
    expect([...userAuditSearchConfig.columnIds] as string[]).toEqual([
      ...userAuditListConfig.sortableColumns,
    ]);
    expect([...userAuditSearchConfig.filterableColumnIds].toSorted() as string[]).toEqual(
      Object.keys(userAuditListConfig.filterableColumns).sort(),
    );
  });

  test("defaults to newest first, 20 per page and no filters", () => {
    expect(userAuditSearchDefaults.sort).toEqual([{ id: "createdAt", desc: true }]);
    expect(userAuditSearchDefaults.perPage).toBe(20);
    expect(userAuditSearchDefaults.filters).toEqual([]);
  });

  test("keeps an accepted action filter and drops an unknown action", () => {
    const accepted = filter({ value: "user.email_changed" });
    const rejected = filter({ value: "member.added", filterId: "filter-2" });
    const search = userAuditSearchSchema.parse({ filters: [accepted, rejected] });
    expect(search.filters.map((item) => item.filterId)).toEqual(["filter-1"]);
  });

  test("builds the audit.listSelf input from the search", () => {
    const input = toUserAuditListInput(userAuditSearchDefaults);
    expect(input).toMatchObject({ page: 1, perPage: 20, sort: [{ id: "createdAt", desc: true }] });
  });
});

describe("createUserAuditTabSearchSchema", () => {
  const schema = createUserAuditTabSearchSchema(["details", "activity"], "details");

  test("defaults to the default tab with the default table state", () => {
    expect(schema.parse({})).toEqual({ ...userAuditSearchDefaults, tab: "details" });
  });

  test("keeps a valid tab and the table state", () => {
    const search = schema.parse({ tab: "activity", page: 3, perPage: 50 });
    expect(search.tab).toBe("activity");
    expect(search.page).toBe(3);
    expect(search.perPage).toBe(50);
  });

  test("falls back to the default tab for an unknown tab and strips unknown keys", () => {
    const search = schema.parse({ tab: "danger", other: "x" });
    expect(search.tab).toBe("details");
    expect("other" in search).toBe(false);
  });
});
