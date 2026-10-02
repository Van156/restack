import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import { auditLog } from "../schema/audit";
import { createTestDatabase, requireTestDatabaseOrSkip, resolveTestDatabaseUrl } from "../testing";
import type { TestDatabaseHandle } from "../testing";
import { buildListQuery, countListRows } from "./list-query";
import type { ListFilter, ListQueryInput } from "./list-query";

/**
 * Runs the adapter's SQL against a real Postgres `audit_log` with deterministic fixtures. Rows
 * carry a per-run `targetType` marker so queries and cleanup touch only this suite's rows.
 */
const TEST_DATABASE_URL = resolveTestDatabaseUrl();
const reachable = await requireTestDatabaseOrSkip(TEST_DATABASE_URL, "list-query integration");

const columns = {
  id: auditLog.id,
  action: auditLog.action,
  scope: auditLog.scope,
  actorUserId: auditLog.actorUserId,
  createdAt: auditLog.createdAt,
};

const marker = `list-query-test-${crypto.randomUUID()}`;
const day = (dayOfMonth: number, hour = 12) => new Date(2026, 0, dayOfMonth, hour);
const localMidnight = (dayOfMonth: number) => String(day(dayOfMonth, 0).getTime());

const fixtures = [
  { id: "lq-1", action: "user.login", createdAt: day(10, 9) },
  { id: "lq-2", action: "user.logout", createdAt: day(10, 18) },
  { id: "lq-3", action: "org.created", createdAt: day(11) },
  { id: "lq-4", action: "100%_done", createdAt: day(12) },
  { id: "lq-5", action: "1000 done", createdAt: day(13) },
].map((row) => ({
  ...row,
  id: `${marker}-${row.id}`,
  scope: "platform" as const,
  targetType: marker,
  targetId: "t",
}));

const base: ListQueryInput = {
  page: 1,
  perPage: 100,
  sort: [{ id: "createdAt", desc: false }],
  filters: [],
  joinOperator: "and",
};

const text = (id: string, operator: ListFilter["operator"], value = ""): ListFilter => ({
  id,
  variant: "text",
  operator,
  value,
});
const date = (operator: ListFilter["operator"], value: string | string[]): ListFilter => ({
  id: "createdAt",
  variant: "date",
  operator,
  value,
});

describe.skipIf(!reachable)("list-query against audit_log", () => {
  let handle: TestDatabaseHandle;

  async function actions(input: Partial<ListQueryInput>): Promise<string[]> {
    const query = buildListQuery({
      columns,
      input: { ...base, ...input },
      tieBreakers: [auditLog.id],
    });
    const rows = await handle.db
      .select({ action: auditLog.action })
      .from(auditLog)
      .where(and(eq(auditLog.targetType, marker), query.where))
      .orderBy(...query.orderBy)
      .limit(query.limit)
      .offset(query.offset);
    return rows.map((row) => row.action);
  }

  beforeAll(async () => {
    handle = createTestDatabase(TEST_DATABASE_URL);
    await handle.db.insert(auditLog).values(fixtures);
  });

  afterAll(async () => {
    await handle.db.delete(auditLog).where(eq(auditLog.targetType, marker));
    await handle.close();
  });

  test("iLike is case-insensitive and substring", async () => {
    expect(await actions({ filters: [text("action", "iLike", "LOGIN")] })).toEqual(["user.login"]);
    expect(await actions({ filters: [text("action", "notILike", "user")] })).toEqual([
      "org.created",
      "100%_done",
      "1000 done",
    ]);
  });

  test("LIKE wildcards in the input match literally", async () => {
    expect(await actions({ filters: [text("action", "iLike", "%")] })).toEqual(["100%_done"]);
    expect(await actions({ filters: [text("action", "iLike", "%_d")] })).toEqual(["100%_done"]);
    expect(await actions({ filters: [text("action", "iLike", "0_d")] })).toEqual([]);
    expect(await actions({ filters: [text("action", "iLike", "0%d")] })).toEqual([]);
  });

  test("eq and ne", async () => {
    expect(await actions({ filters: [text("action", "eq", "org.created")] })).toEqual([
      "org.created",
    ]);
    expect(await actions({ filters: [text("action", "ne", "org.created")] })).toHaveLength(4);
  });

  test("date eq covers the whole local day", async () => {
    expect(await actions({ filters: [date("eq", localMidnight(10))] })).toEqual([
      "user.login",
      "user.logout",
    ]);
    expect(await actions({ filters: [date("ne", localMidnight(10))] })).toHaveLength(3);
  });

  test("date lt, lte, gt, gte and isBetween follow the day boundaries", async () => {
    expect(await actions({ filters: [date("lt", localMidnight(11))] })).toEqual([
      "user.login",
      "user.logout",
    ]);
    expect(await actions({ filters: [date("lte", localMidnight(11))] })).toHaveLength(3);
    expect(await actions({ filters: [date("gt", localMidnight(12))] })).toEqual(["1000 done"]);
    expect(await actions({ filters: [date("gte", localMidnight(12))] })).toEqual([
      "100%_done",
      "1000 done",
    ]);
    expect(
      await actions({ filters: [date("isBetween", [localMidnight(10), localMidnight(11)])] }),
    ).toEqual(["user.login", "user.logout", "org.created"]);
  });

  test("select, multiSelect and isEmpty on enum and nullable columns", async () => {
    const select = (operator: ListFilter["operator"], value: string): ListFilter => ({
      id: "scope",
      variant: "select",
      operator,
      value,
    });
    expect(await actions({ filters: [select("eq", "platform")] })).toHaveLength(5);
    expect(await actions({ filters: [select("ne", "platform")] })).toEqual([]);
    expect(
      await actions({
        filters: [{ id: "scope", variant: "select", operator: "isEmpty", value: "" }],
      }),
    ).toEqual([]);
    expect(
      await actions({
        filters: [
          {
            id: "action",
            variant: "multiSelect",
            operator: "inArray",
            value: ["user.login", "org.created"],
          },
        ],
      }),
    ).toEqual(["user.login", "org.created"]);
    expect(await actions({ filters: [text("actorUserId", "isEmpty")] })).toHaveLength(5);
    expect(await actions({ filters: [text("actorUserId", "isNotEmpty")] })).toEqual([]);
  });

  test("joins with or, sorts, paginates and counts", async () => {
    const or: Partial<ListQueryInput> = {
      joinOperator: "or",
      filters: [text("action", "eq", "user.login"), text("action", "eq", "org.created")],
    };
    expect(await actions(or)).toEqual(["user.login", "org.created"]);
    expect(await actions({ ...or, joinOperator: "and" })).toEqual([]);

    expect(await actions({ sort: [{ id: "createdAt", desc: true }], perPage: 2 })).toEqual([
      "1000 done",
      "100%_done",
    ]);
    expect(await actions({ sort: [{ id: "createdAt", desc: true }], perPage: 2, page: 3 })).toEqual(
      ["user.login"],
    );
    expect(
      await actions({
        sort: [
          { id: "scope", desc: false },
          { id: "action", desc: true },
        ],
        perPage: 2,
      }),
    ).toEqual(["user.logout", "user.login"]);

    const query = buildListQuery({ columns, input: { ...base, perPage: 2 } });
    const total = await countListRows(
      handle.db,
      auditLog,
      and(eq(auditLog.targetType, marker), query.where),
    );
    expect(total).toBe(5);
    expect(await countListRows(handle.db, auditLog, inArray(auditLog.id, [fixtures[0]!.id]))).toBe(
      1,
    );
  });
});
