import * as schema from "@base-template/db/schema";
import { auditLog } from "@base-template/db/schema/audit";
import {
  createTestDatabase,
  requireTestDatabaseOrSkip,
  resolveTestDatabaseUrl,
} from "@base-template/db/testing";
import type { TestDatabaseHandle } from "@base-template/db/testing";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";

import { truncateAllTables } from "../testing";
import { purgeExpiredAuditLog } from "./retention";

/**
 * Integration tests for `purgeExpiredAuditLog` (R7.6) against a real
 * Postgres database. Skips cleanly locally (fails loudly in CI) when no test
 * database is reachable (T5b).
 */
const TEST_DATABASE_URL = resolveTestDatabaseUrl();

const reachable = await requireTestDatabaseOrSkip(
  TEST_DATABASE_URL,
  "purgeExpiredAuditLog integration",
);

describe.skipIf(!reachable)("purgeExpiredAuditLog integration (R7.6)", () => {
  let handle: TestDatabaseHandle;
  let userId: string;

  beforeAll(() => {
    handle = createTestDatabase(TEST_DATABASE_URL);
  });

  afterAll(async () => {
    await handle.close();
  });

  beforeEach(async () => {
    await truncateAllTables(handle.db);
    userId = crypto.randomUUID();
    await handle.db.insert(schema.user).values({
      id: userId,
      name: "Audit Actor",
      email: `${userId}@example.com`,
      emailVerified: true,
    });
  });

  async function insertRow(id: string, createdAt: Date): Promise<void> {
    await handle.db.insert(auditLog).values({
      id,
      scope: "platform",
      actorUserId: userId,
      action: "user.banned",
      targetType: "user",
      targetId: "target-1",
      createdAt,
    });
  }

  test("removes only rows older than the retention window, keeping the rest", async () => {
    const now = new Date("2026-06-01T00:00:00.000Z");
    await insertRow("old-1", new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000));
    await insertRow("old-2", new Date(now.getTime() - 31 * 24 * 60 * 60 * 1000));
    await insertRow("recent-1", new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000));
    await insertRow("recent-2", now);

    const deletedCount = await purgeExpiredAuditLog(handle.db, 30, now);

    expect(deletedCount).toBe(2);
    const remaining = await handle.db.select({ id: auditLog.id }).from(auditLog);
    const remainingIds = remaining.map((row) => row.id).sort();
    expect(remainingIds).toEqual(["recent-1", "recent-2"]);
  });

  test("deletes nothing when every row is within the retention window", async () => {
    const now = new Date("2026-06-01T00:00:00.000Z");
    await insertRow("recent-1", now);

    const deletedCount = await purgeExpiredAuditLog(handle.db, 30, now);

    expect(deletedCount).toBe(0);
    const remaining = await handle.db.select({ id: auditLog.id }).from(auditLog);
    expect(remaining).toHaveLength(1);
  });

  test("purges expired rows spanning multiple bounded batches (T6a)", async () => {
    // PURGE_BATCH_SIZE is 1000 (retention.ts); insert well over two batches
    // of EXPIRED rows, plus a couple of rows that must survive, to prove the
    // implementation loops until fewer than a full batch is removed instead
    // of stopping after the first round-trip.
    const now = new Date("2026-06-01T00:00:00.000Z");
    const expiredCreatedAt = new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000);
    const rowCount = 2200;
    const values = Array.from({ length: rowCount }, (_, index) => ({
      id: `expired-${index}`,
      scope: "platform" as const,
      actorUserId: userId,
      action: "user.banned" as const,
      targetType: "user",
      targetId: "target-1",
      createdAt: expiredCreatedAt,
    }));
    // Insert in chunks: a single multi-thousand-row VALUES list is needless
    // strain on the test itself, not the code under test.
    const insertChunkSize = 500;
    for (let offset = 0; offset < values.length; offset += insertChunkSize) {
      await handle.db.insert(auditLog).values(values.slice(offset, offset + insertChunkSize));
    }
    await insertRow("recent-1", now);
    await insertRow("recent-2", now);

    const deletedCount = await purgeExpiredAuditLog(handle.db, 30, now);

    expect(deletedCount).toBe(rowCount);
    const remaining = await handle.db.select({ id: auditLog.id }).from(auditLog);
    expect(remaining.map((row) => row.id).sort()).toEqual(["recent-1", "recent-2"]);
  });
});
