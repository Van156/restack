import type { ListFilter, ListQueryInput } from "@base-template/db/lib/list-query";
import { describe, expect, test } from "bun:test";

import { conditionToSql, fakeListDb, recordingListDb } from "./fake-list-db";
import { listOrganizationMembers } from "./org-members";

const input = (overrides: Partial<ListQueryInput> = {}): ListQueryInput => ({
  page: 1,
  perPage: 20,
  sort: [],
  filters: [],
  joinOperator: "and",
  ...overrides,
});

const text = (id: string, value: string): ListFilter => ({
  id,
  variant: "text",
  operator: "iLike",
  value,
});

const fakeDb = (outcome: (rows: unknown[]) => Promise<unknown[]>) =>
  fakeListDb(outcome, { innerJoin: true });
const recordingDb = () => recordingListDb({ innerJoin: true });
const toSql = conditionToSql;

describe("listOrganizationMembers", () => {
  test("always constrains both queries to the given organization", async () => {
    const { db, wheres } = recordingDb();
    await listOrganizationMembers(db, { organizationId: "org-a", input: input() });

    expect(wheres).toHaveLength(2);
    for (const where of wheres) {
      const query = toSql(where);
      expect(query?.sql).toContain('"member"."organization_id" = $1');
      expect(query?.params[0]).toBe("org-a");
    }
  });

  test("keeps the organization condition outside an or-joined filter group", async () => {
    const { db, wheres } = recordingDb();
    await listOrganizationMembers(db, {
      organizationId: "org-a",
      input: input({
        joinOperator: "or",
        filters: [text("name", "ada"), text("email", "ada")],
      }),
    });

    const sql = toSql(wheres[0])?.sql ?? "";
    // `(org = $1) and ((name ilike ..) or (email ilike ..))`: the tenant condition is a
    // top-level conjunct that precedes the or group, never one of its branches.
    expect(sql).toMatch(/^\(\("member"\."organization_id" = \$1\) and \(+/);
    expect(sql.indexOf(" and ")).toBeLessThan(sql.indexOf(" or "));
  });

  test("a failing database rejects instead of resolving an empty page", async () => {
    const failure = new Error("connection refused");
    const { db } = fakeDb(() => Promise.reject(failure));

    await expect(
      listOrganizationMembers(db, { organizationId: "org-a", input: input() }),
    ).rejects.toBe(failure);
  });
});
