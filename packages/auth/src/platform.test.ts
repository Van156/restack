import type { Database } from "@base-template/db";
import type { ListFilter, ListQueryInput } from "@base-template/db/lib/list-query";
import { describe, expect, test } from "bun:test";

import { conditionToSql, fakeListDb, recordingListDb } from "./fake-list-db";
import { listPlatformUsers, UnsupportedFilterError } from "./platform";

const input = (overrides: Partial<ListQueryInput> = {}): ListQueryInput => ({
  page: 1,
  perPage: 20,
  sort: [],
  filters: [],
  joinOperator: "and",
  ...overrides,
});

const select = (
  id: string,
  value: string,
  operator: ListFilter["operator"] = "eq",
): ListFilter => ({
  id,
  variant: "select",
  operator,
  value,
});

const fakeDb = (outcome: (rows: unknown[]) => Promise<unknown[]>) => fakeListDb(outcome);
const recordingDb = () => recordingListDb();
const toSql = conditionToSql;

describe("listPlatformUsers", () => {
  test("a failing database rejects instead of resolving an empty page", async () => {
    const failure = new Error("connection refused");
    const db = {
      select: () => {
        throw failure;
      },
    } as unknown as Database;

    await expect(listPlatformUsers(db, input())).rejects.toBe(failure);
  });

  test("a rejected query rejects too", async () => {
    const failure = new Error("relation does not exist");
    const { db } = fakeDb(() => Promise.reject(failure));

    await expect(listPlatformUsers(db, input())).rejects.toBe(failure);
  });

  test("status active is not-banned, so a NULL flag is active", async () => {
    const { db, wheres } = recordingDb();
    await listPlatformUsers(db, input({ filters: [select("status", "active")] }));

    const query = toSql(wheres[0]);
    expect(query?.sql).toContain("is true");
    expect(query?.sql).toMatch(/^not /);
  });

  test("status banned is the flag being true", async () => {
    const { db, wheres } = recordingDb();
    await listPlatformUsers(db, input({ filters: [select("status", "banned")] }));

    const query = toSql(wheres[0]);
    expect(query?.sql).toContain("is true");
    expect(query?.sql).not.toMatch(/^not /);
  });

  test("role eq matches one entry of the comma-separated list", async () => {
    const { db, wheres } = recordingDb();
    await listPlatformUsers(db, input({ filters: [select("role", "superadmin")] }));

    const query = toSql(wheres[0]);
    expect(query?.sql).toContain("string_to_array");
    expect(query?.params).toContain("superadmin");
  });

  const listFilter = (
    id: string,
    operator: ListFilter["operator"],
    value: ListFilter["value"],
  ): ListFilter => ({ id, variant: "select", operator, value });

  test("status inArray [banned] is the banned flag", async () => {
    const { db, wheres } = recordingDb();
    await listPlatformUsers(db, input({ filters: [listFilter("status", "inArray", ["banned"])] }));

    const query = toSql(wheres[0]);
    expect(query?.sql).toContain("is true");
    expect(query?.sql).not.toMatch(/^not /);
  });

  test("status notInArray [banned] is the negated banned flag", async () => {
    const { db, wheres } = recordingDb();
    await listPlatformUsers(
      db,
      input({ filters: [listFilter("status", "notInArray", ["banned"])] }),
    );

    const query = toSql(wheres[0]);
    expect(query?.sql).toContain("is true");
    expect(query?.sql).toMatch(/^not /);
  });

  test("status inArray with every status matches every row", async () => {
    const { db, wheres } = recordingDb();
    await listPlatformUsers(
      db,
      input({ filters: [listFilter("status", "inArray", ["active", "banned"])] }),
    );

    expect(toSql(wheres[0])?.sql).toBe("true");
  });

  test("role inArray overlaps the comma-separated list", async () => {
    const { db, wheres } = recordingDb();
    await listPlatformUsers(
      db,
      input({ filters: [listFilter("role", "inArray", ["superadmin", "user"])] }),
    );

    const query = toSql(wheres[0]);
    expect(query?.sql).toContain("string_to_array");
    expect(query?.sql).toContain("&&");
    expect(query?.sql).not.toMatch(/^not /);
    expect(query?.params).toEqual(expect.arrayContaining(["superadmin", "user"]));
  });

  test("role notInArray negates the overlap", async () => {
    const { db, wheres } = recordingDb();
    await listPlatformUsers(
      db,
      input({ filters: [listFilter("role", "notInArray", ["superadmin"])] }),
    );

    const query = toSql(wheres[0]);
    expect(query?.sql).toContain("&&");
    expect(query?.sql).toMatch(/^not /);
  });

  test.each(["status", "role"])("%s: an empty inArray matches no row", async (id) => {
    const { db, wheres } = recordingDb();
    await listPlatformUsers(db, input({ filters: [listFilter(id, "inArray", [])] }));

    expect(toSql(wheres[0])?.sql).toBe("false");
  });

  test.each(["status", "role"])("%s: an empty notInArray restricts nothing", async (id) => {
    const { db, wheres } = recordingDb();
    await listPlatformUsers(db, input({ filters: [listFilter(id, "notInArray", [])] }));

    expect(toSql(wheres[0])?.sql).toBe("true");
  });

  test("role isEmpty is handled without the generic adapter", async () => {
    const { db, wheres } = recordingDb();
    await listPlatformUsers(db, input({ filters: [listFilter("role", "isEmpty", "")] }));

    expect(toSql(wheres[0])?.sql).toContain("string_to_array");
  });

  test.each([
    ["status", "iLike", "banned"],
    ["status", "eq", ["banned"]],
    ["status", "inArray", "banned"],
    ["role", "iLike", "user"],
    ["role", "eq", ["user"]],
    ["role", "inArray", "user"],
    ["status", "inArray", ["banned", 1]],
    ["status", "notInArray", [null]],
    ["role", "inArray", ["user", 1]],
    ["role", "notInArray", [{}]],
    ["status", "eq", "suspended"],
    ["status", "ne", "suspended"],
    ["status", "inArray", ["banned", "suspended"]],
    ["status", "notInArray", ["suspended"]],
  ] as const)(
    "%s %s with value %p is rejected, never passed to the adapter",
    async (id, op, value) => {
      const { db } = recordingDb();
      await expect(
        listPlatformUsers(
          db,
          input({ filters: [listFilter(id, op, value as ListFilter["value"])] }),
        ),
      ).rejects.toBeInstanceOf(UnsupportedFilterError);
    },
  );

  test("the unsupported message names an array value as an array", async () => {
    const { db } = recordingDb();
    await expect(
      listPlatformUsers(db, input({ filters: [listFilter("status", "eq", ["banned"])] })),
    ).rejects.toThrow('Unsupported status filter: operator "eq" with array value');
  });

  test("derived and plain filters are joined with the join operator", async () => {
    const { db, wheres } = recordingDb();
    await listPlatformUsers(
      db,
      input({
        joinOperator: "or",
        filters: [
          select("status", "banned"),
          { id: "email", variant: "text", operator: "iLike", value: "ada" },
        ],
      }),
    );

    const query = toSql(wheres[0]);
    expect(query?.sql).toContain(" or ");
    expect(query?.sql).toContain("ilike");
  });
});
