import type { AuthConfig } from "@base-template/auth";
import { createAuth } from "@base-template/auth";
import {
  RecordingAuditLogger,
  RecordingEmailSender,
  resolveTestDatabaseUrl,
  truncateAllTables,
} from "@base-template/auth/testing";
import * as schema from "@base-template/db/schema";
import { createTestDatabase, requireTestDatabaseOrSkip } from "@base-template/db/testing";
import type { TestDatabaseHandle } from "@base-template/db/testing";
import { call, ORPCError } from "@orpc/server";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { testUtils } from "better-auth/plugins";
import type { TestHelpers } from "better-auth/plugins";

import { createBetterAuthAuthorization } from "../authorization";
import type { Context } from "../context";
import { createBetterAuthPlatformAdmin } from "../platform-admin";
import { organizationRouter } from "./organization";

/**
 * Integration tests for `organization.transferOwnership` against a real Postgres database:
 * the atomic role swap and its audit rows (R8.1), the guards (R8.2), the target's owned-org limit
 * (R8.3, including the re-check under the row lock), the CONFLICT path and the audit-failure
 * policy. Skips cleanly locally (fails loudly in CI) when no test database is reachable.
 */
const TEST_DATABASE_URL = resolveTestDatabaseUrl();

const reachable = await requireTestDatabaseOrSkip(
  TEST_DATABASE_URL,
  "organization transfer ownership",
);

describe.skipIf(!reachable)("organization transfer ownership", () => {
  let handle: TestDatabaseHandle;
  let auth: ReturnType<typeof createAuth>;
  let testHelpers: TestHelpers;
  let authConfig: AuthConfig;
  let auditLogger: RecordingAuditLogger;

  beforeAll(async () => {
    handle = createTestDatabase(TEST_DATABASE_URL);
    authConfig = {
      BETTER_AUTH_URL: "http://localhost:3000",
      BETTER_AUTH_SECRET: "a-32-character-long-test-secret",
      CORS_ORIGIN: "http://localhost:3001",
      DEFAULT_MAX_ORGS_PER_USER: 2,
    };
    auditLogger = new RecordingAuditLogger();
    auth = createAuth(authConfig, handle.db, new RecordingEmailSender(), auditLogger, {
      extraPlugins: [testUtils()],
    });
    const authContext = await auth.$context;
    testHelpers = (authContext as unknown as { test: TestHelpers }).test;
  });

  afterAll(async () => {
    await handle.close();
  });

  beforeEach(async () => {
    await truncateAllTables(handle.db);
    auditLogger.reset();
  });

  async function buildContext(headers: Headers): Promise<Context> {
    const session = await auth.api.getSession({ headers });
    return {
      db: handle.db,
      session,
      headers,
      authorization: createBetterAuthAuthorization(auth),
      platformAdmin: createBetterAuthPlatformAdmin(auth),
      auditLogger,
      defaultMaxOrganizationsPerUser: authConfig.DEFAULT_MAX_ORGS_PER_USER,
      clock: { now: () => new Date() },
    };
  }

  async function createOrg(id: string): Promise<void> {
    await handle.db.insert(schema.organization).values({ id, name: id, slug: id });
  }

  async function createUser(id: string, name: string, email = `${id}@example.com`) {
    await handle.db.insert(schema.user).values({ id, name, email, emailVerified: true });
  }

  /** Member ids are `<org>:<user>`; `createdAt` orders join order. */
  async function addMember(organizationId: string, userId: string, role = "member", day = 1) {
    await handle.db.insert(schema.member).values({
      id: `${organizationId}:${userId}`,
      organizationId,
      userId,
      role,
      createdAt: new Date(2026, 0, day),
    });
  }

  /** A signed-in caller whose session has `activeOrganizationId` (a membership is not implied). */
  async function contextFor(userId: string, activeOrganizationId?: string) {
    const { headers } = await testHelpers.login({
      userId,
      session: activeOrganizationId ? { activeOrganizationId } : undefined,
    });
    return buildContext(headers);
  }

  async function codeOf(promise: Promise<unknown>): Promise<string | undefined> {
    try {
      await promise;
    } catch (error) {
      return error instanceof ORPCError ? error.code : "NOT_AN_ORPC_ERROR";
    }
    return undefined;
  }

  async function roleOf(organizationId: string, userId: string) {
    const [row] = await handle.db
      .select({ role: schema.member.role })
      .from(schema.member)
      .where(
        and(eq(schema.member.organizationId, organizationId), eq(schema.member.userId, userId)),
      );
    return row?.role;
  }

  async function transfer(
    context: Context,
    input: { organizationId: string; targetMemberId: string },
  ) {
    return call(organizationRouter.transferOwnership, input, { context });
  }

  beforeEach(async () => {
    await createOrg("org-a");
    await createOrg("org-b");
    await createUser("owner", "Owner");
    await createUser("target", "Target");
    await createUser("other", "Other");
    await addMember("org-a", "owner", "owner");
    await addMember("org-a", "target", "member");
    await addMember("org-b", "other", "member");
  });

  describe("R8.1 atomic transfer", () => {
    test("target becomes owner, caller becomes admin, two role_changed rows are recorded", async () => {
      const context = await contextFor("owner", "org-a");

      await transfer(context, { organizationId: "org-a", targetMemberId: "org-a:target" });

      expect(await roleOf("org-a", "target")).toBe("owner");
      expect(await roleOf("org-a", "owner")).toBe("admin");
      const events = auditLogger.eventsFor("member.role_changed");
      expect(events).toHaveLength(2);
      expect(events).toContainEqual(
        expect.objectContaining({
          scope: "organization",
          organizationId: "org-a",
          actorUserId: "owner",
          targetType: "member",
          targetId: "org-a:target",
          metadata: {
            organizationName: "org-a",
            memberUserId: "target",
            previousRole: "member",
            newRole: "owner",
          },
        }),
      );
      expect(events).toContainEqual(
        expect.objectContaining({
          actorUserId: "owner",
          targetId: "org-a:owner",
          metadata: {
            organizationName: "org-a",
            memberUserId: "owner",
            previousRole: "owner",
            newRole: "admin",
          },
        }),
      );
    });

    test("an already-owner target only demotes the caller, with one audit row", async () => {
      await handle.db
        .update(schema.member)
        .set({ role: "owner" })
        .where(eq(schema.member.id, "org-a:target"));
      const context = await contextFor("owner", "org-a");

      await transfer(context, { organizationId: "org-a", targetMemberId: "org-a:target" });

      expect(await roleOf("org-a", "target")).toBe("owner");
      expect(await roleOf("org-a", "owner")).toBe("admin");
      expect(auditLogger.eventsFor("member.role_changed")).toHaveLength(1);
    });

    test("an already-owner target at the org limit is not blocked", async () => {
      await createOrg("org-c");
      await handle.db
        .update(schema.member)
        .set({ role: "owner" })
        .where(eq(schema.member.id, "org-a:target"));
      await addMember("org-c", "target", "owner");
      const context = await contextFor("owner", "org-a");

      await transfer(context, { organizationId: "org-a", targetMemberId: "org-a:target" });

      expect(await roleOf("org-a", "owner")).toBe("admin");
    });
  });

  describe("R8.3 limit re-checked under the row lock", () => {
    test("a limit that tightens after the fast-path check still blocks the transfer", async () => {
      await createOrg("org-c");
      await addMember("org-c", "target", "owner");
      const context = await contextFor("owner", "org-a");
      // The fast-path check passes (default limit 2, target owns 1). Just before the transaction
      // opens, the target's per-user limit drops to 1, so only the check under the lock can see it.
      const db = new Proxy(context.db, {
        get(dbTarget, property, receiver) {
          if (property !== "transaction") return Reflect.get(dbTarget, property, receiver);
          return async (...args: Parameters<typeof dbTarget.transaction>) => {
            await dbTarget
              .update(schema.user)
              .set({ maxOrganizations: 1 })
              .where(eq(schema.user.id, "target"));
            return dbTarget.transaction(...args);
          };
        },
      });
      const racing: Context = { ...context, db };

      const code = await codeOf(
        transfer(racing, { organizationId: "org-a", targetMemberId: "org-a:target" }),
      );

      expect(code).toBe("TARGET_REACHED_MAXIMUM_NUMBER_OF_ORGANIZATIONS");
      expect(await roleOf("org-a", "target")).toBe("member");
      expect(await roleOf("org-a", "owner")).toBe("owner");
      expect(auditLogger.events).toHaveLength(0);
    });
  });

  describe("R8.3 limit serialized per target user", () => {
    test("a transfer waits for the target's user row lock, then sees the competing ownership", async () => {
      await createOrg("org-c");
      await createOrg("org-d");
      await addMember("org-c", "target", "owner");
      const context = await contextFor("owner", "org-a");
      let releaseHolder!: () => void;
      const release = new Promise<void>((resolve) => {
        releaseHolder = resolve;
      });
      let holderHasLock!: () => void;
      const locked = new Promise<void>((resolve) => {
        holderHasLock = resolve;
      });
      // Stands in for a concurrent transfer to the same target in another org: it holds the
      // target's user row lock and, before releasing, makes the target an owner of org-d (2 of 2).
      const holder = handle.db.transaction(async (tx) => {
        await tx.select().from(schema.user).where(eq(schema.user.id, "target")).for("update");
        holderHasLock();
        await release;
        await tx.insert(schema.member).values({
          id: "org-d:target",
          organizationId: "org-d",
          userId: "target",
          role: "owner",
        });
      });
      await locked;

      let settled = false;
      const result = codeOf(
        transfer(context, { organizationId: "org-a", targetMemberId: "org-a:target" }),
      ).finally(() => {
        settled = true;
      });
      // Without the per-user lock the transfer would pass the count and finish within this window.
      await new Promise((resolve) => setTimeout(resolve, 500));
      const settledWhileLocked = settled;

      releaseHolder();
      await holder;
      expect(settledWhileLocked).toBe(false);

      expect(await result).toBe("TARGET_REACHED_MAXIMUM_NUMBER_OF_ORGANIZATIONS");
      expect(await roleOf("org-a", "target")).toBe("member");
      expect(await roleOf("org-a", "owner")).toBe("owner");
    });
  });

  describe("CONFLICT under the row lock", () => {
    test("a caller who is no longer owner at lock time gets CONFLICT and nothing changes", async () => {
      const context = await contextFor("owner", "org-a");
      // The authorization port still reports the stale owner role (as if read before the demotion),
      // while the database already says admin.
      const stale: Context = {
        ...context,
        authorization: {
          ...context.authorization,
          getActiveMembership: async () => ({
            organizationId: "org-a",
            memberId: "org-a:owner",
            role: "owner",
          }),
        },
      };
      await handle.db
        .update(schema.member)
        .set({ role: "admin" })
        .where(eq(schema.member.id, "org-a:owner"));

      const code = await codeOf(
        transfer(stale, { organizationId: "org-a", targetMemberId: "org-a:target" }),
      );

      expect(code).toBe("CONFLICT");
      expect(await roleOf("org-a", "target")).toBe("member");
      expect(await roleOf("org-a", "owner")).toBe("admin");
      expect(auditLogger.events).toHaveLength(0);
    });
  });

  describe("audit write failure (R7.2)", () => {
    test("a throwing audit logger fails the request although the roles already changed", async () => {
      const context = await contextFor("owner", "org-a");
      const failing: Context = {
        ...context,
        auditLogger: {
          record: async () => {
            throw new Error("audit store down");
          },
        },
      };

      await expect(
        transfer(failing, { organizationId: "org-a", targetMemberId: "org-a:target" }),
      ).rejects.toThrow("audit store down");

      // The role swap committed before the audit write (documented policy, not rolled back).
      expect(await roleOf("org-a", "target")).toBe("owner");
      expect(await roleOf("org-a", "owner")).toBe("admin");
    });
  });

  describe("R8.2 guards", () => {
    test("a non-owner caller is forbidden and nothing changes", async () => {
      await addMember("org-a", "other", "admin");
      const context = await contextFor("other", "org-a");

      const code = await codeOf(
        transfer(context, { organizationId: "org-a", targetMemberId: "org-a:target" }),
      );

      expect(code).toBe("FORBIDDEN");
      expect(await roleOf("org-a", "target")).toBe("member");
      expect(auditLogger.events).toHaveLength(0);
    });

    test("a target who is not a member is rejected", async () => {
      const context = await contextFor("owner", "org-a");

      const code = await codeOf(
        transfer(context, { organizationId: "org-a", targetMemberId: "org-a:nobody" }),
      );

      expect(code).toBe("NOT_FOUND");
      expect(await roleOf("org-a", "owner")).toBe("owner");
    });

    test("a member of another organization is rejected", async () => {
      const context = await contextFor("owner", "org-a");

      const code = await codeOf(
        transfer(context, { organizationId: "org-a", targetMemberId: "org-b:other" }),
      );

      expect(code).toBe("NOT_FOUND");
      expect(await roleOf("org-b", "other")).toBe("member");
      expect(await roleOf("org-a", "owner")).toBe("owner");
    });

    test("the caller cannot be the target", async () => {
      const context = await contextFor("owner", "org-a");

      const code = await codeOf(
        transfer(context, { organizationId: "org-a", targetMemberId: "org-a:owner" }),
      );

      expect(code).toBe("BAD_REQUEST");
      expect(await roleOf("org-a", "owner")).toBe("owner");
    });

    test("an organization id that differs from the active organization is rejected", async () => {
      await addMember("org-b", "owner", "owner");
      await addMember("org-b", "target", "member");
      const context = await contextFor("owner", "org-a");

      const code = await codeOf(
        transfer(context, { organizationId: "org-b", targetMemberId: "org-b:target" }),
      );

      expect(code).toBe("BAD_REQUEST");
      expect(await roleOf("org-b", "target")).toBe("member");
      expect(await roleOf("org-b", "owner")).toBe("owner");
    });
  });

  describe("R8.3 org limit", () => {
    test("a target at their owned-org limit fails and nothing changes", async () => {
      await createOrg("org-c");
      await createOrg("org-d");
      await addMember("org-c", "target", "owner");
      await addMember("org-d", "target", "owner");
      const context = await contextFor("owner", "org-a");

      const code = await codeOf(
        transfer(context, { organizationId: "org-a", targetMemberId: "org-a:target" }),
      );

      expect(code).toBe("TARGET_REACHED_MAXIMUM_NUMBER_OF_ORGANIZATIONS");
      expect(await roleOf("org-a", "target")).toBe("member");
      expect(await roleOf("org-a", "owner")).toBe("owner");
      expect(auditLogger.events).toHaveLength(0);
    });

    test("a per-user override raises the limit for the target", async () => {
      await createOrg("org-c");
      await createOrg("org-d");
      await addMember("org-c", "target", "owner");
      await addMember("org-d", "target", "owner");
      await handle.db
        .update(schema.user)
        .set({ maxOrganizations: 5 })
        .where(eq(schema.user.id, "target"));
      const context = await contextFor("owner", "org-a");

      await transfer(context, { organizationId: "org-a", targetMemberId: "org-a:target" });

      expect(await roleOf("org-a", "target")).toBe("owner");
    });
  });
});
