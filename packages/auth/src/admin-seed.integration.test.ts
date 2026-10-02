import * as schema from "@base-template/db/schema";
import {
  createTestDatabase,
  requireTestDatabaseOrSkip,
  resolveTestDatabaseUrl,
} from "@base-template/db/testing";
import type { TestDatabaseHandle } from "@base-template/db/testing";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";

import { seedPlatformAdmins } from "./admin-seed";

/**
 * Integration tests for the R6.1 superadmin seed command's core logic
 * against a real Postgres database. The CLI wrapper
 * (`apps/server/scripts/seed-admins.ts`) only parses `PLATFORM_ADMIN_EMAILS`
 * and calls this function — never a public endpoint (R6.1). Skips cleanly
 * locally (fails loudly in CI) when no test database is reachable (T5b).
 */
const TEST_DATABASE_URL = resolveTestDatabaseUrl();

const reachable = await requireTestDatabaseOrSkip(TEST_DATABASE_URL, "seedPlatformAdmins (R6.1)");

describe.skipIf(!reachable)("seedPlatformAdmins (R6.1)", () => {
  let handle: TestDatabaseHandle;

  beforeAll(() => {
    handle = createTestDatabase(TEST_DATABASE_URL);
  });

  afterAll(async () => {
    await handle.close();
  });

  beforeEach(async () => {
    await handle.db.delete(schema.user);
  });

  async function createUser(id: string, email: string, role: string | null = "user") {
    await handle.db
      .insert(schema.user)
      .values({ id, name: "Test User", email, emailVerified: true, role });
  }

  test("promotes an existing user to superadmin, appending it to their existing role (T7c)", async () => {
    await createUser("user-1", "admin@example.com");

    const result = await seedPlatformAdmins(handle.db, ["admin@example.com"]);

    expect(result).toEqual({
      promoted: ["admin@example.com"],
      alreadySuperadmin: [],
      missing: [],
    });
    const [user] = await handle.db
      .select({ role: schema.user.role })
      .from(schema.user)
      .where(eq(schema.user.id, "user-1"));
    // Default seeded role is "user" (createUser's default) — appended, not
    // overwritten (T7c: a superadmin retains any other role(s) they held).
    expect(user!.role).toBe("user,superadmin");
  });

  test("appends superadmin to a user's existing comma-separated roles instead of overwriting them (T7c)", async () => {
    await createUser("user-1", "billing@example.com", "billing,ops");

    const result = await seedPlatformAdmins(handle.db, ["billing@example.com"]);

    expect(result).toEqual({
      promoted: ["billing@example.com"],
      alreadySuperadmin: [],
      missing: [],
    });
    const [user] = await handle.db
      .select({ role: schema.user.role })
      .from(schema.user)
      .where(eq(schema.user.id, "user-1"));
    expect(user!.role).toBe("billing,ops,superadmin");
  });

  test("promoting a user with a null role sets it to exactly superadmin (T7c)", async () => {
    await createUser("user-1", "noroles@example.com", null);

    await seedPlatformAdmins(handle.db, ["noroles@example.com"]);

    const [user] = await handle.db
      .select({ role: schema.user.role })
      .from(schema.user)
      .where(eq(schema.user.id, "user-1"));
    expect(user!.role).toBe("superadmin");
  });

  test("is idempotent: re-running with an already-superadmin user changes nothing and reports it separately", async () => {
    await createUser("user-1", "admin@example.com", "superadmin");

    const result = await seedPlatformAdmins(handle.db, ["admin@example.com"]);

    expect(result).toEqual({
      promoted: [],
      alreadySuperadmin: ["admin@example.com"],
      missing: [],
    });
  });

  test("reports (and never creates an account for) an email with no existing user", async () => {
    const result = await seedPlatformAdmins(handle.db, ["nobody@example.com"]);

    expect(result).toEqual({
      promoted: [],
      alreadySuperadmin: [],
      missing: ["nobody@example.com"],
    });
    const users = await handle.db.select().from(schema.user);
    expect(users).toHaveLength(0);
  });

  test("normalizes email casing/whitespace and handles a mixed list", async () => {
    await createUser("user-1", "mixed@example.com");
    await createUser("user-2", "already@example.com", "superadmin");

    const result = await seedPlatformAdmins(handle.db, [
      "  Mixed@Example.com  ",
      "already@example.com",
      "missing@example.com",
    ]);

    expect(result.promoted).toEqual(["mixed@example.com"]);
    expect(result.alreadySuperadmin).toEqual(["already@example.com"]);
    expect(result.missing).toEqual(["missing@example.com"]);
  });

  test("ignores blank entries in the list", async () => {
    const result = await seedPlatformAdmins(handle.db, ["", "   ", ""]);
    expect(result).toEqual({ promoted: [], alreadySuperadmin: [], missing: [] });
  });
});
