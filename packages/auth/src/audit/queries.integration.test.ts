import * as schema from "@base-template/db/schema";
import { auditLog } from "@base-template/db/schema/audit";
import {
  createTestDatabase,
  requireTestDatabaseOrSkip,
  resolveTestDatabaseUrl,
} from "@base-template/db/testing";
import type { TestDatabaseHandle } from "@base-template/db/testing";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { sql } from "drizzle-orm";

import { truncateAllTables } from "../testing";
import type { ListFilter, ListQueryInput } from "@base-template/db/lib/list-query";
import { listOrganizationAuditLog, listPlatformAuditLog } from "./queries";

/**
 * Integration tests for the R7.4/R7.5 audit-log read path against a real
 * Postgres database: organization-scoped listing is always filtered by
 * `organizationId` (never by client-controlled scope or filters, whatever
 * the join operator), sorted and paginated by a parsed list input with a
 * `{ rows, total }` result; platform-scoped listing spans both scopes and
 * every filter R7.5 names. Skips cleanly locally (fails loudly in CI) when
 * no test database is reachable (T5b).
 */

const DEFAULT_SORT = [{ id: "createdAt", desc: true }];

/** A parsed list input (what `createListInput` yields), with the audit defaults. */
function listInput(overrides: Partial<ListQueryInput> = {}): ListQueryInput {
  return {
    page: 1,
    perPage: 20,
    sort: DEFAULT_SORT,
    filters: [],
    joinOperator: "and",
    ...overrides,
  };
}

function filter(
  id: string,
  variant: ListFilter["variant"],
  operator: ListFilter["operator"],
  value: string | string[],
): ListFilter {
  return { id, variant, operator, value };
}

/** Local-midnight epoch ms string of a calendar day, as the date filter sends it. */
const dayEpoch = (year: number, month: number, day: number) =>
  String(new Date(year, month, day).getTime());
const TEST_DATABASE_URL = resolveTestDatabaseUrl();

const reachable = await requireTestDatabaseOrSkip(
  TEST_DATABASE_URL,
  "audit log read path (R7.4, R7.5)",
);

describe.skipIf(!reachable)("audit log read path (R7.4, R7.5)", () => {
  let handle: TestDatabaseHandle;
  let orgAId: string;
  let orgBId: string;
  let userId: string;
  let otherUserId: string;

  beforeAll(() => {
    handle = createTestDatabase(TEST_DATABASE_URL);
  });

  afterAll(async () => {
    await handle.close();
  });

  beforeEach(async () => {
    await truncateAllTables(handle.db);
    orgAId = crypto.randomUUID();
    orgBId = crypto.randomUUID();
    userId = crypto.randomUUID();
    otherUserId = crypto.randomUUID();
    await handle.db.insert(schema.organization).values([
      { id: orgAId, name: "Org A", slug: `org-a-${orgAId}` },
      { id: orgBId, name: "Org B", slug: `org-b-${orgBId}` },
    ]);
    await handle.db.insert(schema.user).values([
      { id: userId, name: "Actor", email: `${userId}@example.com`, emailVerified: true },
      {
        id: otherUserId,
        name: "Other Actor",
        email: `${otherUserId}@example.com`,
        emailVerified: true,
      },
    ]);
  });

  /** Inserts a row directly (bypasses `AuditLogger`, which isn't under test here). */
  async function insertRow(overrides: Partial<typeof auditLog.$inferInsert> = {}) {
    await handle.db.insert(auditLog).values({
      scope: "organization",
      organizationId: orgAId,
      actorUserId: userId,
      action: "organization.updated",
      targetType: "organization",
      targetId: orgAId,
      ...overrides,
    });
  }

  describe("database timezone", () => {
    test("the session timezone is UTC, so timestamp (no tz) day windows hold", async () => {
      const result = await handle.db.execute(sql`select current_setting('TimeZone') as tz`);
      const row = (result.rows as { tz: string }[])[0];
      expect(["UTC", "Etc/UTC"]).toContain(row?.tz as string);
    });
  });

  describe("listOrganizationAuditLog", () => {
    const list = (input: Partial<ListQueryInput> = {}, organizationId = orgAId) =>
      listOrganizationAuditLog(handle.db, { organizationId, input: listInput(input) });

    test("returns only the given organization's entries, newest first, with the total", async () => {
      await insertRow({
        organizationId: orgAId,
        action: "organization.created",
        createdAt: new Date(2026, 0, 1),
      });
      await insertRow({
        organizationId: orgAId,
        action: "organization.updated",
        createdAt: new Date(2026, 0, 3),
      });
      await insertRow({
        organizationId: orgBId,
        action: "organization.updated",
        createdAt: new Date(2026, 0, 2),
      });
      await insertRow({
        scope: "platform",
        organizationId: null,
        action: "user.banned",
        targetType: "user",
        targetId: userId,
        createdAt: new Date(2026, 0, 4),
      });

      const page = await list();

      expect(page.rows.map((row) => row.action)).toEqual([
        "organization.updated",
        "organization.created",
      ]);
      expect(page.total).toBe(2);
      expect(page.rows.every((row) => row.organizationId === orgAId)).toBe(true);
    });

    test("never leaks another organization's rows, even with an `or` join that matches them", async () => {
      await insertRow({ organizationId: orgAId, action: "member.added", actorUserId: userId });
      await insertRow({
        organizationId: orgBId,
        action: "member.removed",
        actorUserId: otherUserId,
      });
      await insertRow({ organizationId: orgBId, action: "member.added", actorUserId: otherUserId });
      await insertRow({
        scope: "platform",
        organizationId: null,
        action: "user.banned",
        targetType: "user",
        targetId: userId,
      });

      // Each branch of the OR matches rows of org B and the platform scope.
      const page = await list({
        joinOperator: "or",
        filters: [
          filter("action", "select", "eq", "member.removed"),
          filter("actor", "select", "eq", otherUserId),
          filter("action", "select", "ne", "member.added"),
        ],
      });

      expect(page.rows).toHaveLength(0);
      expect(page.total).toBe(0);

      const widened = await list({
        joinOperator: "or",
        filters: [
          filter("actor", "select", "eq", otherUserId),
          filter("action", "select", "eq", "member.added"),
        ],
      });
      expect(widened.rows.map((row) => row.organizationId)).toEqual([orgAId]);
      expect(widened.total).toBe(1);
    });

    test("filters by action, actor, target type and date range", async () => {
      await insertRow({
        action: "organization.updated",
        actorUserId: userId,
        createdAt: new Date(2026, 0, 1),
      });
      await insertRow({
        action: "organization.updated",
        actorUserId: otherUserId,
        createdAt: new Date(2026, 0, 2, 13),
      });
      await insertRow({
        action: "member.removed",
        actorUserId: userId,
        targetType: "member",
        createdAt: new Date(2026, 0, 3),
      });

      const byAction = await list({
        filters: [filter("action", "select", "eq", "member.removed")],
      });
      expect(byAction.rows).toHaveLength(1);
      expect(byAction.rows[0]!.action).toBe("member.removed");

      const byActor = await list({ filters: [filter("actor", "select", "eq", otherUserId)] });
      expect(byActor.rows).toHaveLength(1);
      expect(byActor.rows[0]!.actorUserId).toBe(otherUserId);

      const byTarget = await list({ filters: [filter("targetType", "text", "iLike", "MEMB")] });
      expect(byTarget.rows.map((row) => row.targetType)).toEqual(["member"]);

      const byDay = await list({
        filters: [filter("createdAt", "date", "eq", dayEpoch(2026, 0, 2))],
      });
      expect(byDay.rows).toHaveLength(1);
      expect(byDay.rows[0]!.actorUserId).toBe(otherUserId);

      const byRange = await list({
        filters: [
          filter("createdAt", "date", "isBetween", [dayEpoch(2026, 0, 2), dayEpoch(2026, 0, 3)]),
        ],
      });
      expect(byRange.rows).toHaveLength(2);
    });

    test("a day filter is the half-open window [local midnight, +24h): its last millisecond is in, the next midnight is out", async () => {
      await insertRow({
        action: "organization.updated",
        createdAt: new Date(2026, 0, 2, 0, 0, 0, 0),
      });
      await insertRow({
        action: "organization.updated",
        createdAt: new Date(2026, 0, 2, 23, 59, 59, 999),
      });
      await insertRow({ action: "organization.updated", createdAt: new Date(2026, 0, 3) });
      await insertRow({
        action: "organization.updated",
        createdAt: new Date(2026, 0, 1, 23, 59, 59, 999),
      });

      const eq = await list({ filters: [filter("createdAt", "date", "eq", dayEpoch(2026, 0, 2))] });
      expect(eq.total).toBe(2);

      const range = await list({
        filters: [
          filter("createdAt", "date", "isBetween", [dayEpoch(2026, 0, 2), dayEpoch(2026, 0, 3)]),
        ],
      });
      // `to` is a whole day: [Jan 2 00:00, Jan 4 00:00) holds the Jan 2 pair and the Jan 3 midnight row.
      expect(range.total).toBe(3);

      const before = await list({
        filters: [filter("createdAt", "date", "lt", dayEpoch(2026, 0, 2))],
      });
      expect(before.total).toBe(1);
    });

    test("sorts by a requested column and by several columns", async () => {
      await insertRow({
        action: "role.updated",
        targetType: "organizationRole",
        createdAt: new Date(2026, 0, 1),
      });
      await insertRow({
        action: "member.added",
        targetType: "member",
        createdAt: new Date(2026, 0, 2),
      });
      await insertRow({
        action: "member.added",
        targetType: "invitation",
        createdAt: new Date(2026, 0, 3),
      });

      const byAction = await list({
        sort: [
          { id: "action", desc: false },
          { id: "createdAt", desc: true },
        ],
      });
      expect(byAction.rows.map((row) => [row.action, row.targetType])).toEqual([
        ["member.added", "invitation"],
        ["member.added", "member"],
        ["role.updated", "organizationRole"],
      ]);
    });

    test("paginates by page and perPage and reports the total past the page", async () => {
      for (let i = 0; i < 5; i++) {
        await insertRow({ action: "organization.updated", createdAt: new Date(2026, 0, i + 1) });
      }

      const firstPage = await list({ perPage: 2 });
      expect(firstPage.rows).toHaveLength(2);
      expect(firstPage.total).toBe(5);

      const lastPage = await list({ perPage: 2, page: 3 });
      expect(lastPage.rows).toHaveLength(1);
      expect(lastPage.total).toBe(5);

      const beyond = await list({ perPage: 2, page: 9 });
      expect(beyond.rows).toHaveLength(0);
      expect(beyond.total).toBe(5);
    });

    test("tie-breaks identical createdAt timestamps by id, so a page boundary has no duplicates or gaps (T6d)", async () => {
      const tiedCreatedAt = new Date(2026, 0, 5);
      const ids = ["row-a", "row-b", "row-c", "row-d"];
      for (const id of ids) {
        await insertRow({ id, action: "organization.updated", createdAt: tiedCreatedAt });
      }

      const firstPage = await list({ perPage: 2 });
      const secondPage = await list({ perPage: 2, page: 2 });

      expect(firstPage.rows).toHaveLength(2);
      expect(secondPage.rows).toHaveLength(2);
      const seenIds = [...firstPage.rows, ...secondPage.rows].map((row) => row.id);
      expect(new Set(seenIds).size).toBe(4); // no duplicates
      expect([...seenIds].sort()).toEqual([...ids].sort()); // no gaps
      // `createdAt` ties are broken by `id` ascending, so the split is exact and
      // reproducible, not merely "whatever order Postgres happens to return".
      expect(seenIds).toEqual(["row-a", "row-b", "row-c", "row-d"]);
    });

    test("never returns platform-scope entries, even without a filter", async () => {
      await insertRow({
        scope: "platform",
        organizationId: null,
        action: "user.banned",
        targetType: "user",
        targetId: userId,
      });

      const page = await list();
      expect(page.rows).toHaveLength(0);
      expect(page.total).toBe(0);
    });

    test("an unknown column id throws instead of reaching SQL", async () => {
      await expect(
        list({ filters: [filter("passwordHash", "text", "eq", "x")] }),
      ).rejects.toThrow();
    });
  });

  describe("listPlatformAuditLog", () => {
    const list = (input: Partial<ListQueryInput> = {}) =>
      listPlatformAuditLog(handle.db, listInput(input));

    test("returns entries across both scopes and every organization, newest first", async () => {
      await insertRow({
        organizationId: orgAId,
        action: "organization.created",
        createdAt: new Date(2026, 0, 1),
      });
      await insertRow({
        scope: "platform",
        organizationId: null,
        action: "user.banned",
        targetType: "user",
        targetId: userId,
        createdAt: new Date(2026, 0, 2),
      });
      await insertRow({
        organizationId: orgBId,
        action: "organization.updated",
        createdAt: new Date(2026, 0, 3),
      });

      const page = await list();

      expect(page.rows.map((row) => row.action)).toEqual([
        "organization.updated",
        "user.banned",
        "organization.created",
      ]);
      expect(page.total).toBe(3);
    });

    test("filters by organization, scope, actor and action (R7.5)", async () => {
      await insertRow({
        organizationId: orgAId,
        action: "organization.updated",
        actorUserId: userId,
      });
      await insertRow({
        organizationId: orgBId,
        action: "organization.updated",
        actorUserId: userId,
      });
      await insertRow({
        scope: "platform",
        organizationId: null,
        action: "user.banned",
        actorUserId: otherUserId,
        targetType: "user",
        targetId: userId,
      });

      const byOrg = await list({ filters: [filter("organization", "text", "eq", orgBId)] });
      expect(byOrg.rows).toHaveLength(1);
      expect(byOrg.rows[0]!.organizationId).toBe(orgBId);

      const byScope = await list({ filters: [filter("scope", "select", "eq", "platform")] });
      expect(byScope.rows.map((row) => row.action)).toEqual(["user.banned"]);

      const byActor = await list({ filters: [filter("actor", "text", "eq", otherUserId)] });
      expect(byActor.rows).toHaveLength(1);
      expect(byActor.rows[0]!.action).toBe("user.banned");

      const byAction = await list({
        filters: [filter("action", "select", "eq", "organization.updated")],
      });
      expect(byAction.rows).toHaveLength(2);
      expect(byAction.total).toBe(2);
    });

    test("paginates newest first and reports the total", async () => {
      for (let i = 0; i < 5; i++) {
        await insertRow({ action: "organization.updated", createdAt: new Date(2026, 0, i + 1) });
      }

      const page = await list({ perPage: 3 });
      expect(page.rows).toHaveLength(3);
      expect(page.total).toBe(5);
    });
  });
});
