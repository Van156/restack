import type { AuthConfig } from "@base-template/auth";
import { createAuth } from "@base-template/auth";
import {
  RecordingAuditLogger,
  RecordingEmailSender,
  resolveTestDatabaseUrl,
  truncateAllTables,
} from "@base-template/auth/testing";
import * as schema from "@base-template/db/schema";
import { createTestDatabase } from "@base-template/db/testing";
import type { TestDatabaseHandle } from "@base-template/db/testing";
import { testUtils } from "better-auth/plugins";
import type { TestHelpers } from "better-auth/plugins";

import { createBetterAuthAuthorization } from "../authorization";
import type { Clock, Context } from "../context";
import { createBetterAuthPlatformAdmin } from "../platform-admin";

/** Restaurant staff roles seeded by {@link RestaurantHarness.seedRestaurant}. */
export type RestaurantStaffKey = "owner" | "admin" | "cashierA" | "waiterA" | "waiterB";

export type SeededStaff = { userId: string; memberId: string };

export type RestaurantSeed = {
  organizationId: string;
  /** A second, unrelated organization with one Location, for cross-tenant checks. */
  otherOrganizationId: string;
  locations: { a: string; b: string; other: string };
  /** Owner (no assignments), Administrator (Location A), Cashier A, Waiter A, Waiter B. */
  staff: Record<RestaurantStaffKey, SeededStaff>;
};

export type RestaurantHarness = {
  db: TestDatabaseHandle["db"];
  auditLogger: RecordingAuditLogger;
  /** Mutable test clock; `setNow` moves it. Starts at 2026-10-02T15:00:00Z. */
  clock: Clock & { setNow(date: Date): void };
  /** Truncates every table and clears recorded audit events. */
  reset(): Promise<void>;
  /** Seeds one Restaurant organization with two Locations and one member of each Role. */
  seedRestaurant(): Promise<RestaurantSeed>;
  /** API context for a signed-in user whose active organization is `organizationId`. */
  contextFor(userId: string, organizationId: string): Promise<Context>;
  close(): Promise<void>;
};

const AUTH_CONFIG: AuthConfig = {
  BETTER_AUTH_URL: "http://localhost:3000",
  BETTER_AUTH_SECRET: "a-32-character-long-test-secret",
  CORS_ORIGIN: "http://localhost:3001",
  DEFAULT_MAX_ORGS_PER_USER: 10,
};

/**
 * Integration-test harness for restaurant procedures: real Postgres, real auth, recording audit
 * logger and a controllable clock. Mirrors the `members.integration.test.ts` approach.
 * Callers must have confirmed the test database is reachable (`requireTestDatabaseOrSkip`).
 */
export async function createRestaurantHarness(): Promise<RestaurantHarness> {
  const handle = createTestDatabase(resolveTestDatabaseUrl());
  const auditLogger = new RecordingAuditLogger();
  const auth = createAuth(AUTH_CONFIG, handle.db, new RecordingEmailSender(), auditLogger, {
    extraPlugins: [testUtils()],
  });
  const testHelpers = ((await auth.$context) as unknown as { test: TestHelpers }).test;

  let nowMs = new Date("2026-10-02T15:00:00.000Z").getTime();
  const clock = {
    now: () => new Date(nowMs),
    setNow: (date: Date) => {
      nowMs = date.getTime();
    },
  };

  async function createOrganization(id: string) {
    await handle.db.insert(schema.organization).values({ id, name: id, slug: id });
  }

  async function createStaff(
    organizationId: string,
    key: string,
    role: string,
  ): Promise<SeededStaff> {
    const userId = `${organizationId}-${key}`;
    await handle.db.insert(schema.user).values({
      id: userId,
      name: key,
      email: `${userId}@example.com`,
      emailVerified: true,
    });
    const memberId = `${organizationId}:${userId}`;
    await handle.db.insert(schema.member).values({ id: memberId, organizationId, userId, role });
    return { userId, memberId };
  }

  async function createLocation(organizationId: string, id: string, name: string) {
    await handle.db.insert(schema.location).values({ id, organizationId, name });
  }

  async function assign(organizationId: string, staff: SeededStaff, locationId: string) {
    await handle.db
      .insert(schema.staffLocationAssignment)
      .values({ organizationId, memberId: staff.memberId, locationId });
  }

  return {
    db: handle.db,
    auditLogger,
    clock,
    async reset() {
      await truncateAllTables(handle.db);
      auditLogger.reset();
    },
    async seedRestaurant() {
      const organizationId = "resto";
      const otherOrganizationId = "resto-other";
      await createOrganization(organizationId);
      await createOrganization(otherOrganizationId);
      const locations = { a: "loc-a", b: "loc-b", other: "loc-other" };
      await createLocation(organizationId, locations.a, "Sede A");
      await createLocation(organizationId, locations.b, "Sede B");
      await createLocation(otherOrganizationId, locations.other, "Sede ajena");

      const staff = {
        owner: await createStaff(organizationId, "owner", "owner"),
        admin: await createStaff(organizationId, "admin", "admin"),
        cashierA: await createStaff(organizationId, "cashier-a", "cashier"),
        waiterA: await createStaff(organizationId, "waiter-a", "waiter"),
        waiterB: await createStaff(organizationId, "waiter-b", "waiter"),
      };
      await assign(organizationId, staff.admin, locations.a);
      await assign(organizationId, staff.cashierA, locations.a);
      await assign(organizationId, staff.waiterA, locations.a);
      await assign(organizationId, staff.waiterB, locations.b);
      return { organizationId, otherOrganizationId, locations, staff };
    },
    async contextFor(userId, organizationId) {
      const { headers } = await testHelpers.login({
        userId,
        session: { activeOrganizationId: organizationId },
      });
      const session = await auth.api.getSession({ headers });
      return {
        db: handle.db,
        session,
        headers,
        authorization: createBetterAuthAuthorization(auth),
        platformAdmin: createBetterAuthPlatformAdmin(auth),
        auditLogger,
        defaultMaxOrganizationsPerUser: AUTH_CONFIG.DEFAULT_MAX_ORGS_PER_USER,
        clock,
      };
    },
    close: () => handle.close(),
  };
}
