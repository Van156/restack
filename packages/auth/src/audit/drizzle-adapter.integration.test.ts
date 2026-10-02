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
import { createDrizzleAuditLogger } from "./drizzle-adapter";
import type { AuditLogger } from "./types";

/**
 * Integration tests for `createDrizzleAuditLogger` against a real Postgres
 * database (docs/specs/auth-multitenant-rbac.md §5, R7.2, R7.3, T5).
 * Skips cleanly locally (fails loudly in CI) when no test database is
 * reachable (T5b).
 */
const TEST_DATABASE_URL = resolveTestDatabaseUrl();

const reachable = await requireTestDatabaseOrSkip(
  TEST_DATABASE_URL,
  "createDrizzleAuditLogger integration",
);

describe.skipIf(!reachable)("createDrizzleAuditLogger integration", () => {
  let handle: TestDatabaseHandle;
  let logger: AuditLogger;
  let userId: string;

  beforeAll(() => {
    handle = createTestDatabase(TEST_DATABASE_URL);
  });

  afterAll(async () => {
    await handle.close();
  });

  beforeEach(async () => {
    await truncateAllTables(handle.db);
    logger = createDrizzleAuditLogger(handle.db);
    userId = crypto.randomUUID();
    await handle.db.insert(schema.user).values({
      id: userId,
      name: "Audit Actor",
      email: `${userId}@example.com`,
      emailVerified: true,
    });
  });

  test("records an event, readable back with all fields", async () => {
    await logger.record({
      scope: "platform",
      actorUserId: userId,
      action: "user.banned",
      targetType: "user",
      targetId: "target-1",
      metadata: { targetEmail: "target@example.com", banReason: "spam" },
      ip: "203.0.113.5",
      userAgent: "test-agent/1.0",
    });

    const rows = await handle.db.select().from(auditLog);
    expect(rows).toHaveLength(1);
    const row = rows[0]!;
    expect(row.scope).toBe("platform");
    expect(row.organizationId).toBeNull();
    expect(row.actorUserId).toBe(userId);
    expect(row.impersonatorUserId).toBeNull();
    expect(row.action).toBe("user.banned");
    expect(row.targetType).toBe("user");
    expect(row.targetId).toBe("target-1");
    expect(row.metadata).toEqual({ targetEmail: "target@example.com", banReason: "spam" });
    expect(row.ip).toBe("203.0.113.5");
    expect(row.userAgent).toBe("test-agent/1.0");
    expect(row.createdAt).toBeInstanceOf(Date);
  });

  test("fail-the-request policy: logs and rethrows when the write fails (T5, R7.2)", async () => {
    const originalConsoleError = console.error;
    const logged: unknown[][] = [];
    console.error = (...args: unknown[]) => {
      logged.push(args);
    };

    try {
      await expect(
        logger.record({
          scope: "platform",
          // A user id that does not exist violates the actorUserId FK.
          actorUserId: "does-not-exist",
          action: "user.banned",
          targetType: "user",
          targetId: "target-1",
        }),
      ).rejects.toThrow();
    } finally {
      console.error = originalConsoleError;
    }

    expect(logged.length).toBeGreaterThan(0);
    expect(String(logged[0]?.[0])).toContain("failed to record event");

    // The failed write must not have left a partial/committed row.
    const rows = await handle.db.select().from(auditLog);
    expect(rows).toHaveLength(0);
  });
});
