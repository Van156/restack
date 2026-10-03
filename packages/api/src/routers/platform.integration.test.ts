import type { AuthConfig } from "@base-template/auth";
import { createAuth } from "@base-template/auth";
import { createDrizzleAuditLogger } from "@base-template/auth/audit";
import {
  RecordingEmailSender,
  resolveTestDatabaseUrl,
  signUpAndVerify as sharedSignUpAndVerify,
  truncateAllTables,
} from "@base-template/auth/testing";
import * as schema from "@base-template/db/schema";
import { createTestDatabase, requireTestDatabaseOrSkip } from "@base-template/db/testing";
import type { TestDatabaseHandle } from "@base-template/db/testing";
import { call, ORPCError } from "@orpc/server";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { testUtils } from "better-auth/plugins";
import type { TestHelpers } from "better-auth/plugins";

import { createBetterAuthAuthorization } from "../authorization";
import type { Context } from "../context";
import { createBetterAuthPlatformAdmin } from "../platform-admin";
import { platformRouter } from "./platform";

/**
 * Integration tests for the R6 platform admin router against a real
 * Postgres database, following `audit.integration.test.ts`'s setup pattern
 * (real `createAuth` + `createBetterAuthAuthorization`/`createBetterAuthPlatformAdmin`,
 * T3.1g shared helpers). Uses a real `createDrizzleAuditLogger` so R6.7's
 * "exactly one audit_log entry, not duplicated by this router" claim is
 * checked against actual rows, not an in-memory fake. Skips cleanly locally
 * (fails loudly in CI) when no test database is reachable (T5b).
 */
const TEST_DATABASE_URL = resolveTestDatabaseUrl();

const reachable = await requireTestDatabaseOrSkip(TEST_DATABASE_URL, "platform admin router (R6)");

describe.skipIf(!reachable)("platform admin router (R6)", () => {
  let handle: TestDatabaseHandle;
  let emailSender: RecordingEmailSender;
  let auth: ReturnType<typeof createAuth>;
  let testHelpers: TestHelpers;
  let authConfig: AuthConfig;

  beforeAll(async () => {
    handle = createTestDatabase(TEST_DATABASE_URL);
    emailSender = new RecordingEmailSender();
    const auditLogger = createDrizzleAuditLogger(handle.db);
    authConfig = {
      BETTER_AUTH_URL: "http://localhost:3000",
      BETTER_AUTH_SECRET: "a-32-character-long-test-secret",
      CORS_ORIGIN: "http://localhost:3001",
      DEFAULT_MAX_ORGS_PER_USER: 10,
    };
    auth = createAuth(authConfig, handle.db, emailSender, auditLogger, {
      extraPlugins: [testUtils()],
    });
    const authContext = await auth.$context;
    testHelpers = (authContext as unknown as { test: TestHelpers }).test;
  });

  afterAll(async () => {
    await handle.close();
  });

  beforeEach(async () => {
    emailSender.reset();
    await truncateAllTables(handle.db);
  });

  function signUpAndVerify(
    email: string,
    name: string,
  ): Promise<{ headers: Headers; userId: string }> {
    return sharedSignUpAndVerify(auth, emailSender, email, name);
  }

  async function buildContext(headers: Headers): Promise<Context> {
    const session = await auth.api.getSession({ headers });
    return {
      db: handle.db,
      session,
      headers,
      authorization: createBetterAuthAuthorization(auth),
      platformAdmin: createBetterAuthPlatformAdmin(auth),
      // Unused by the router under test.
      auditLogger: {} as unknown as Context["auditLogger"],
      defaultMaxOrganizationsPerUser: authConfig.DEFAULT_MAX_ORGS_PER_USER,
      clock: { now: () => new Date() },
      actingTokenSecret: "test-acting-token-secret-0000000",
    };
  }

  async function superadminContext(): Promise<{
    context: Context;
    headers: Headers;
    userId: string;
  }> {
    const superadminUser = testHelpers.createUser({ role: "superadmin" });
    await testHelpers.saveUser(superadminUser);
    const { headers } = await testHelpers.login({ userId: superadminUser.id });
    return { context: await buildContext(headers), headers, userId: superadminUser.id };
  }

  async function countAuditRows(action: string): Promise<number> {
    const { auditLog } = await import("@base-template/db/schema/audit");
    const rows = await handle.db.select().from(auditLog).where(eq(auditLog.action, action));
    return rows.length;
  }

  describe("R6.5 layer isolation", () => {
    test("an org owner is forbidden from every platform procedure, including when acting on their own account", async () => {
      const { headers: ownerHeaders, userId: ownerId } = await signUpAndVerify(
        "layer-owner@example.com",
        "Owner",
      );
      await auth.api.createOrganization({
        body: { name: "Layer Org", slug: "layer-org" },
        headers: ownerHeaders,
      });
      const context = await buildContext(ownerHeaders);
      const { userId: targetId } = await signUpAndVerify("layer-target@example.com", "Target");

      const invocations: Array<[string, () => Promise<unknown>]> = [
        ["users.list", () => call(platformRouter.users.list, {}, { context })],
        [
          "users.ban",
          () => call(platformRouter.users.ban, { userId: targetId, reason: "x" }, { context }),
        ],
        ["users.unban", () => call(platformRouter.users.unban, { userId: targetId }, { context })],
        [
          "users.setOrganizationLimit",
          () =>
            call(
              platformRouter.users.setOrganizationLimit,
              { userId: targetId, maxOrganizations: 5 },
              { context },
            ),
        ],
        ["organizations.list", () => call(platformRouter.organizations.list, {}, { context })],
        [
          "users.ban (self)",
          () => call(platformRouter.users.ban, { userId: ownerId, reason: "x" }, { context }),
        ],
      ];

      for (const [name, invoke] of invocations) {
        let error: unknown;
        try {
          await invoke();
        } catch (thrown) {
          error = thrown;
        }
        expect(error, `${name} should be forbidden for an org owner`).toBeInstanceOf(ORPCError);
        expect((error as ORPCError<string, unknown>).code, name).toBe("FORBIDDEN");
      }
    });

    test("an unauthenticated caller is unauthorized, not forbidden", async () => {
      const context = await buildContext(new Headers());

      let error: unknown;
      try {
        await call(platformRouter.users.list, {}, { context });
      } catch (thrown) {
        error = thrown;
      }
      expect(error).toBeInstanceOf(ORPCError);
      expect((error as ORPCError<string, unknown>).code).toBe("UNAUTHORIZED");
    });
  });

  describe("R6.2 list users and organizations", () => {
    test("a superadmin searches/paginates users", async () => {
      const { userId } = await signUpAndVerify("alice-search@example.com", "Alice");
      const { context } = await superadminContext();

      const page = await call(
        platformRouter.users.list,
        { filters: [{ id: "email", variant: "text", operator: "iLike", value: "ALICE-search" }] },
        { context },
      );

      expect(page.total).toBe(1);
      expect(page.users.map((user) => user.id)).toEqual([userId]);
    });

    test("users filter by role and status", async () => {
      const { userId } = await signUpAndVerify("carol-plain@example.com", "Carol");
      const { context } = await superadminContext();

      const supers = await call(
        platformRouter.users.list,
        { filters: [{ id: "role", variant: "select", operator: "eq", value: "superadmin" }] },
        { context },
      );
      expect(supers.total).toBeGreaterThanOrEqual(1);
      expect(supers.users.every((user) => user.role?.includes("superadmin"))).toBe(true);
      expect(supers.users.some((user) => user.id === userId)).toBe(false);

      const banned = await call(
        platformRouter.users.list,
        { filters: [{ id: "status", variant: "select", operator: "eq", value: "banned" }] },
        { context },
      );
      expect(banned.users.some((user) => user.id === userId)).toBe(false);
    });

    test("an unknown status value is rejected as a bad request by the input allowlist (the UnsupportedFilterError mapping is defense in depth)", async () => {
      const { context } = await superadminContext();

      let error: unknown;
      try {
        await call(
          platformRouter.users.list,
          { filters: [{ id: "status", variant: "select", operator: "eq", value: "suspended" }] },
          { context },
        );
      } catch (thrown) {
        error = thrown;
      }
      expect(error).toBeInstanceOf(ORPCError);
      expect((error as ORPCError<string, unknown>).code).toBe("BAD_REQUEST");
    });

    test("users sort by email in both directions (collation-independent probe)", async () => {
      // Lowercase letters only with one shared suffix, so every collation (C, glibc, ICU)
      // orders them alike. Signed up out of order so insertion order cannot pass the test.
      const probes = ["orderprobec", "orderprobea", "orderprobeb"].map(
        (local) => `${local}@example.com`,
      );
      for (const email of probes) {
        await signUpAndVerify(email, "Probe");
      }
      const { context } = await superadminContext();
      const sortedEmails = async (desc: boolean) => {
        const page = await call(
          platformRouter.users.list,
          {
            sort: [{ id: "email", desc }],
            filters: [{ id: "email", variant: "text", operator: "iLike", value: "orderprobe" }],
          },
          { context },
        );
        return page.users.map((user) => user.email);
      };

      const ascending = ["orderprobea", "orderprobeb", "orderprobec"].map(
        (local) => `${local}@example.com`,
      );
      expect(await sortedEmails(false)).toEqual(ascending);
      expect(await sortedEmails(true)).toEqual([...ascending].reverse());
    });

    test("a literal % or _ in a user search matches itself, not any text", async () => {
      const { userId: percentId } = await signUpAndVerify("wild-percent@example.com", "zq%zq");
      await signUpAndVerify("wild-plain-a@example.com", "zqxzq");
      const { userId: underscoreId } = await signUpAndVerify(
        "wild-underscore@example.com",
        "zq_zq",
      );
      const { context } = await superadminContext();
      const searchName = async (value: string) => {
        const page = await call(
          platformRouter.users.list,
          { filters: [{ id: "name", variant: "text", operator: "iLike", value }] },
          { context },
        );
        return page.users.map((user) => user.id);
      };

      expect(await searchName("q%z")).toEqual([percentId]);
      expect(await searchName("q_z")).toEqual([underscoreId]);
    });

    test("users accept several sorts and several filters at once", async () => {
      await signUpAndVerify("multi-zed@example.com", "Multi Zed");
      const { userId: keptId } = await signUpAndVerify("multi-kept@example.com", "Multi Kept");
      const { context } = await superadminContext();

      const page = await call(
        platformRouter.users.list,
        {
          sort: [
            { id: "name", desc: false },
            { id: "email", desc: false },
          ],
          filters: [
            { id: "email", variant: "text", operator: "iLike", value: "multi-" },
            { id: "name", variant: "text", operator: "iLike", value: "KEPT" },
          ],
        },
        { context },
      );

      expect(page.users.map((user) => user.id)).toEqual([keptId]);
      expect(page.total).toBe(1);
    });

    test("a superadmin searches/paginates organizations across tenants", async () => {
      const { headers: ownerAHeaders } = await signUpAndVerify(
        "org-list-owner-a@example.com",
        "Owner A",
      );
      const orgA = await auth.api.createOrganization({
        body: { name: "Acme Rockets", slug: "acme-rockets" },
        headers: ownerAHeaders,
      });
      const { headers: ownerBHeaders } = await signUpAndVerify(
        "org-list-owner-b@example.com",
        "Owner B",
      );
      await auth.api.createOrganization({
        body: { name: "Other Co", slug: "other-co" },
        headers: ownerBHeaders,
      });
      const { context } = await superadminContext();

      const page = await call(
        platformRouter.organizations.list,
        { filters: [{ id: "name", variant: "text", operator: "iLike", value: "acme" }] },
        { context },
      );

      expect(page.entries.map((entry) => entry.id)).toEqual([orgA!.id]);
      expect(page.total).toBe(1);
    });
  });

  describe("T9 users.get", () => {
    test("fetches a single user by id and reports the effective default org limit", async () => {
      const { userId } = await signUpAndVerify("bob-detail@example.com", "Bob");
      const { context } = await superadminContext();

      const result = await call(platformRouter.users.get, { userId }, { context });

      expect(result.user.id).toBe(userId);
      expect(result.user.email).toBe("bob-detail@example.com");
      expect(result.defaultMaxOrganizationsPerUser).toBe(10);
    });

    test("an org owner is forbidden (R6.5)", async () => {
      const { headers: ownerHeaders } = await signUpAndVerify(
        "get-user-owner@example.com",
        "Owner",
      );
      await auth.api.createOrganization({
        body: { name: "Get User Org", slug: "get-user-org" },
        headers: ownerHeaders,
      });
      const context = await buildContext(ownerHeaders);

      let error: unknown;
      try {
        await call(platformRouter.users.get, { userId: "whoever" }, { context });
      } catch (thrown) {
        error = thrown;
      }
      expect(error).toBeInstanceOf(ORPCError);
      expect((error as ORPCError<string, unknown>).code).toBe("FORBIDDEN");
    });
  });

  describe("R6.3 ban / unban", () => {
    test("bans with a reason and optional expiry; sessions are revoked and sign-in is refused; unban restores sign-in", async () => {
      const { headers: targetHeaders, userId: targetId } = await signUpAndVerify(
        "ban-target@example.com",
        "Target",
      );
      const { context } = await superadminContext();

      const banned = await call(
        platformRouter.users.ban,
        { userId: targetId, reason: "spam", expiresInSeconds: 3600 },
        { context },
      );
      expect(banned.banned).toBe(true);
      expect(banned.banReason).toBe("spam");

      // The target's pre-ban session is revoked (better-auth's own banUser).
      const sessionAfterBan = await auth.api.getSession({ headers: targetHeaders });
      expect(sessionAfterBan).toBeNull();

      // Sign-in is refused while banned.
      await expect(
        auth.api.signInEmail({
          body: { email: "ban-target@example.com", password: "correct horse battery staple" },
        }),
      ).rejects.toThrow();

      const unbanned = await call(platformRouter.users.unban, { userId: targetId }, { context });
      expect(unbanned.banned).toBe(false);

      const signInAfterUnban = await auth.api.signInEmail({
        body: { email: "ban-target@example.com", password: "correct horse battery staple" },
      });
      expect(signInAfterUnban.user.id).toBe(targetId);
    });

    test("produces exactly one audit_log entry each for ban and unban, not duplicated by this router (R6.7)", async () => {
      const { userId: targetId } = await signUpAndVerify("ban-audit@example.com", "Target");
      const { context } = await superadminContext();

      await call(platformRouter.users.ban, { userId: targetId, reason: "test" }, { context });
      expect(await countAuditRows("user.banned")).toBe(1);

      await call(platformRouter.users.unban, { userId: targetId }, { context });
      expect(await countAuditRows("user.unbanned")).toBe(1);
    });
  });

  describe("R6.6 organization limit override", () => {
    test("sets a non-negative override that blocks new creations once reached, without deleting existing organizations", async () => {
      const { headers: targetHeaders, userId: targetId } = await signUpAndVerify(
        "limit-target@example.com",
        "Target",
      );
      const { context } = await superadminContext();

      await call(
        platformRouter.users.setOrganizationLimit,
        { userId: targetId, maxOrganizations: 1 },
        { context },
      );

      const firstOrg = await auth.api.createOrganization({
        body: { name: "Limit Org One", slug: "limit-org-one" },
        headers: targetHeaders,
      });
      expect(firstOrg?.id).toBeTruthy();

      await expect(
        auth.api.createOrganization({
          body: { name: "Limit Org Two", slug: "limit-org-two" },
          headers: targetHeaders,
        }),
      ).rejects.toThrow();

      // Lowering the limit below the current count blocks new creations but
      // never deletes the existing organization.
      await call(
        platformRouter.users.setOrganizationLimit,
        { userId: targetId, maxOrganizations: 0 },
        { context },
      );
      await expect(
        auth.api.createOrganization({
          body: { name: "Limit Org Three", slug: "limit-org-three" },
          headers: targetHeaders,
        }),
      ).rejects.toThrow();
      const [stillOwned] = await handle.db
        .select({ id: schema.organization.id })
        .from(schema.organization)
        .where(eq(schema.organization.id, firstOrg!.id));
      expect(stillOwned?.id).toBe(firstOrg!.id);
    });

    test("clears the override back to the default via null", async () => {
      const { userId: targetId } = await signUpAndVerify("limit-clear@example.com", "Target");
      const { context } = await superadminContext();

      await call(
        platformRouter.users.setOrganizationLimit,
        { userId: targetId, maxOrganizations: 1 },
        { context },
      );
      const updated = await call(
        platformRouter.users.setOrganizationLimit,
        { userId: targetId, maxOrganizations: null },
        { context },
      );

      expect(updated.maxOrganizations).toBeNull();
    });

    test("produces exactly one audit_log entry per change (R6.7)", async () => {
      const { userId: targetId } = await signUpAndVerify("limit-audit@example.com", "Target");
      const { context } = await superadminContext();

      await call(
        platformRouter.users.setOrganizationLimit,
        { userId: targetId, maxOrganizations: 3 },
        { context },
      );

      expect(await countAuditRows("user.org_limit_changed")).toBe(1);
    });

    test("a user cannot set their own maxOrganizations via sign-up or self profile update", async () => {
      await expect(
        auth.api.signUpEmail({
          body: {
            email: "self-limit@example.com",
            password: "correct horse battery staple",
            name: "Self",
            maxOrganizations: 999,
          } as never,
        }),
      ).rejects.toThrow();

      const { headers } = await signUpAndVerify("self-limit-2@example.com", "Self");
      await expect(
        auth.api.updateUser({
          body: { maxOrganizations: 999 } as never,
          headers,
        }),
      ).rejects.toThrow();
    });
  });
});
