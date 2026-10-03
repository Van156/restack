import type { AuthConfig } from "@base-template/auth";
import { createAuth } from "@base-template/auth";
import { createDrizzleAuditLogger } from "@base-template/auth/audit";
import {
  cookieHeaderFromSetCookie,
  RecordingEmailSender,
  resolveTestDatabaseUrl,
  signUpAndVerify as sharedSignUpAndVerify,
  TEST_PASSWORD,
  truncateAllTables,
} from "@base-template/auth/testing";
import { createTestDatabase, requireTestDatabaseOrSkip } from "@base-template/db/testing";
import type { TestDatabaseHandle } from "@base-template/db/testing";
import { call, ORPCError } from "@orpc/server";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { testUtils } from "better-auth/plugins";
import type { TestHelpers } from "better-auth/plugins";

import { createBetterAuthAuthorization } from "../authorization";
import type { Context } from "../context";
import { createBetterAuthPlatformAdmin } from "../platform-admin";
import { auditRouter } from "./audit";

/**
 * Integration tests for the R7.4/R7.5 audit list procedures against a real
 * Postgres database, following `authorization.integration.test.ts`'s setup
 * (real `createAuth` + `createBetterAuthAuthorization`, T3.1g shared
 * helpers). Skips cleanly locally (fails loudly in CI) when no test database
 * is reachable (T5b).
 */
const TEST_DATABASE_URL = resolveTestDatabaseUrl();

const reachable = await requireTestDatabaseOrSkip(
  TEST_DATABASE_URL,
  "audit list procedures (R7.4, R7.5)",
);

describe.skipIf(!reachable)("audit list procedures (R7.4, R7.5)", () => {
  let handle: TestDatabaseHandle;
  let emailSender: RecordingEmailSender;
  let auth: ReturnType<typeof createAuth>;
  let testHelpers: TestHelpers;
  let authConfig: AuthConfig;

  beforeAll(async () => {
    handle = createTestDatabase(TEST_DATABASE_URL);
    emailSender = new RecordingEmailSender();
    // Real Drizzle-backed logger (not the in-memory `RecordingAuditLogger`):
    // these tests read `audit_log` back through the router, so events must
    // actually land in Postgres.
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

  async function superadminContext(): Promise<Context> {
    const superadminUser = testHelpers.createUser({ role: "superadmin" });
    await testHelpers.saveUser(superadminUser);
    const { headers } = await testHelpers.login({ userId: superadminUser.id });
    return buildContext(headers);
  }

  test("a member without audit:read is forbidden from listing organization activity", async () => {
    const { headers: ownerHeaders } = await signUpAndVerify("audit-owner@example.com", "Owner");
    const org = await auth.api.createOrganization({
      body: { name: "Audit Org", slug: "audit-org" },
      headers: ownerHeaders,
    });
    if (!org) throw new Error("createOrganization returned no organization");

    const { userId: memberUserId } = await signUpAndVerify("audit-member@example.com", "Member");
    await testHelpers.addMember?.({ userId: memberUserId, organizationId: org.id, role: "member" });
    const { headers: memberHeaders } = await testHelpers.login({
      userId: memberUserId,
      session: { activeOrganizationId: org.id },
    });
    const context = await buildContext(memberHeaders);

    let listError: unknown;
    try {
      await call(auditRouter.list, {}, { context });
    } catch (error) {
      listError = error;
    }
    expect(listError).toBeInstanceOf(ORPCError);
    expect((listError as ORPCError<string, unknown>).code).toBe("FORBIDDEN");
  });

  test("an owner with audit:read lists only their own organization's activity, newest first, tenant scoped from the session (R7.4, R5.1)", async () => {
    const { headers: ownerAHeaders } = await signUpAndVerify(
      "audit-iso-owner-a@example.com",
      "Owner A",
    );
    const orgA = await auth.api.createOrganization({
      body: { name: "Audit Isolation Org A", slug: "audit-isolation-org-a" },
      headers: ownerAHeaders,
    });
    const { headers: ownerBHeaders } = await signUpAndVerify(
      "audit-iso-owner-b@example.com",
      "Owner B",
    );
    const orgB = await auth.api.createOrganization({
      body: { name: "Audit Isolation Org B", slug: "audit-isolation-org-b" },
      headers: ownerBHeaders,
    });
    if (!orgA || !orgB) throw new Error("createOrganization returned no organization");

    // Both organizations now have an "organization.created"/"member.added"
    // trail from the createOrganization calls above.
    await auth.api.updateOrganization({
      body: { organizationId: orgA.id, data: { name: "Renamed A" } },
      headers: ownerAHeaders,
    });

    const contextA = await buildContext(ownerAHeaders);
    // A malicious/buggy client trying to smuggle another organization's id
    // into the input must not change which organization is listed: the
    // handler reads `context.org.id`, never anything from `input`.
    const maliciousInput = { organizationId: orgB.id } as unknown as Record<string, never>;
    const page = await call(auditRouter.list, maliciousInput, { context: contextA });

    expect(page.rows.length).toBeGreaterThan(0);
    expect(page.total).toBe(page.rows.length);
    expect(page.rows.every((entry) => entry.organizationId === orgA.id)).toBe(true);
    expect(page.rows[0]!.action).toBe("organization.updated"); // newest first
  });

  test("a filter naming another organization's activity never widens the org scope, even joined with `or` (R5.1)", async () => {
    const { headers: ownerAHeaders } = await signUpAndVerify("audit-or-owner-a@example.com", "A");
    const orgA = await auth.api.createOrganization({
      body: { name: "Audit Or Org A", slug: "audit-or-org-a" },
      headers: ownerAHeaders,
    });
    const { headers: ownerBHeaders, userId: ownerBId } = await signUpAndVerify(
      "audit-or-owner-b@example.com",
      "B",
    );
    const orgB = await auth.api.createOrganization({
      body: { name: "Audit Or Org B", slug: "audit-or-org-b" },
      headers: ownerBHeaders,
    });
    if (!orgA || !orgB) throw new Error("createOrganization returned no organization");

    const contextA = await buildContext(ownerAHeaders);
    const page = await call(
      auditRouter.list,
      {
        joinOperator: "or",
        filters: [
          { id: "actor", variant: "select", operator: "eq", value: ownerBId },
          { id: "action", variant: "select", operator: "eq", value: "organization.created" },
        ],
      },
      { context: contextA },
    );

    // Org B's owner is an actor only in org B; the only match is org A's own creation entry.
    expect(page.rows.length).toBeGreaterThan(0);
    expect(page.rows.every((entry) => entry.organizationId === orgA.id)).toBe(true);
    expect(page.rows.every((entry) => entry.actorUserId !== ownerBId)).toBe(true);

    // The platform-only `organization` filter does not exist on the org procedure.
    let error: unknown;
    try {
      await call(
        auditRouter.list,
        {
          filters: [{ id: "organization", variant: "text", operator: "eq", value: orgB.id }],
        } as never,
        { context: contextA },
      );
    } catch (caught) {
      error = caught;
    }
    expect((error as ORPCError<string, unknown>).code).toBe("BAD_REQUEST");
  });

  test("filters and pagination are honored (R7.4)", async () => {
    const { headers: ownerHeaders, userId: ownerId } = await signUpAndVerify(
      "audit-filter-owner@example.com",
      "Owner",
    );
    const org = await auth.api.createOrganization({
      body: { name: "Audit Filter Org", slug: "audit-filter-org" },
      headers: ownerHeaders,
    });
    if (!org) throw new Error("createOrganization returned no organization");
    const context = await buildContext(ownerHeaders);

    const firstPage = await call(auditRouter.list, { perPage: 1 }, { context });
    expect(firstPage.rows).toHaveLength(1);
    expect(firstPage.total).toBeGreaterThan(1);

    const byAction = await call(
      auditRouter.list,
      {
        filters: [
          { id: "action", variant: "select", operator: "eq", value: "organization.created" },
        ],
      },
      { context },
    );
    expect(byAction.rows).toHaveLength(1);
    expect(byAction.rows[0]!.action).toBe("organization.created");

    const byActor = await call(
      auditRouter.list,
      { filters: [{ id: "actor", variant: "select", operator: "eq", value: ownerId }] },
      { context },
    );
    expect(byActor.rows.length).toBeGreaterThan(0);
    expect(byActor.rows.every((entry) => entry.actorUserId === ownerId)).toBe(true);

    const oldestFirst = await call(
      auditRouter.list,
      { sort: [{ id: "createdAt", desc: false }] },
      { context },
    );
    const times = oldestFirst.rows.map((entry) => entry.createdAt.getTime());
    expect(times).toEqual([...times].sort((a, b) => a - b));

    // Ids and values outside the allowlist are 400s, not database errors.
    for (const input of [
      { sort: [{ id: "actor", desc: false }] },
      { filters: [{ id: "action", variant: "select", operator: "eq", value: "not.an.action" }] },
      { filters: [{ id: "actor", variant: "text", operator: "eq", value: ownerId }] },
    ]) {
      let error: unknown;
      try {
        await call(auditRouter.list, input as never, { context });
      } catch (caught) {
        error = caught;
      }
      expect((error as ORPCError<string, unknown>).code).toBe("BAD_REQUEST");
    }
  });

  test("even an org owner is forbidden from the platform activity log (R6.5 layer isolation)", async () => {
    const { headers: ownerHeaders } = await signUpAndVerify(
      "audit-platform-owner@example.com",
      "Owner",
    );
    await auth.api.createOrganization({
      body: { name: "Platform Denied Org", slug: "platform-denied-org" },
      headers: ownerHeaders,
    });
    const context = await buildContext(ownerHeaders);

    let listError: unknown;
    try {
      await call(auditRouter.listPlatform, {}, { context });
    } catch (error) {
      listError = error;
    }
    expect(listError).toBeInstanceOf(ORPCError);
    expect((listError as ORPCError<string, unknown>).code).toBe("FORBIDDEN");
  });

  test("a superadmin lists entries across both scopes and every organization, filterable by organization (R7.5, R6.7)", async () => {
    const { headers: ownerAHeaders } = await signUpAndVerify(
      "audit-plat-owner-a@example.com",
      "Owner A",
    );
    const orgA = await auth.api.createOrganization({
      body: { name: "Platform Org A", slug: "platform-org-a" },
      headers: ownerAHeaders,
    });
    const { headers: ownerBHeaders } = await signUpAndVerify(
      "audit-plat-owner-b@example.com",
      "Owner B",
    );
    const orgB = await auth.api.createOrganization({
      body: { name: "Platform Org B", slug: "platform-org-b" },
      headers: ownerBHeaders,
    });
    if (!orgA || !orgB) throw new Error("createOrganization returned no organization");

    const { userId: targetUserId } = await signUpAndVerify(
      "audit-plat-target@example.com",
      "Target",
    );
    const superContext = await superadminContext();
    await auth.api.banUser({
      body: { userId: targetUserId, banReason: "test" },
      headers: superContext.headers,
    });

    const allEntries = await call(
      auditRouter.listPlatform,
      { perPage: 100 },
      { context: superContext },
    );
    const scopes = new Set(allEntries.rows.map((entry) => entry.scope));
    expect(scopes.has("organization")).toBe(true);
    expect(scopes.has("platform")).toBe(true);

    const orgAOnly = await call(
      auditRouter.listPlatform,
      {
        filters: [{ id: "organization", variant: "text", operator: "eq", value: orgA.id }],
        perPage: 100,
      },
      { context: superContext },
    );
    expect(orgAOnly.rows.length).toBeGreaterThan(0);
    expect(orgAOnly.total).toBe(orgAOnly.rows.length);
    expect(orgAOnly.rows.every((entry) => entry.organizationId === orgA.id)).toBe(true);
  });

  describe("user-scoped security log (account-settings R7)", () => {
    /** Changes the password and returns the refreshed session cookie (the old one is revoked). */
    async function changePassword(headers: Headers, newPassword: string): Promise<Headers> {
      const response = await auth.api.changePassword({
        body: { currentPassword: TEST_PASSWORD, newPassword },
        headers,
        asResponse: true,
      });
      return cookieHeaderFromSetCookie(response.headers.get("set-cookie"));
    }

    async function codeOf(action: () => Promise<unknown>): Promise<unknown> {
      try {
        await action();
      } catch (error) {
        return (error as ORPCError<string, unknown>).code;
      }
      return undefined;
    }

    test("listSelf returns only the caller's user-scoped rows, newest first (R7.1)", async () => {
      const { headers: aliceHeaders, userId: aliceId } = await signUpAndVerify(
        "self-alice@example.com",
        "Alice",
      );
      const { headers: bobHeaders } = await signUpAndVerify("self-bob@example.com", "Bob");
      await auth.api.revokeOtherSessions({ headers: aliceHeaders });
      const aliceCurrent = await changePassword(aliceHeaders, "alice second passphrase 1");
      await changePassword(bobHeaders, "bob second passphrase 1");

      const context = await buildContext(aliceCurrent);
      const page = await call(auditRouter.listSelf, {}, { context });

      expect(page.total).toBe(1);
      expect(page.rows.map((row) => row.action)).toEqual(["user.password_changed"]);
      expect(page.rows.every((row) => row.scope === "user" && row.targetId === aliceId)).toBe(true);
    });

    test("listSelf rejects an unauthenticated caller", async () => {
      const anonymous = await buildContext(new Headers());
      expect(await codeOf(() => call(auditRouter.listSelf, {}, { context: anonymous }))).toBe(
        "UNAUTHORIZED",
      );
    });

    test("listSelf strips a smuggled userId and returns only the caller's rows (R7.3)", async () => {
      const { headers: aliceHeaders, userId: aliceId } = await signUpAndVerify(
        "smug-alice@example.com",
        "Alice",
      );
      const { headers: bobHeaders, userId: bobId } = await signUpAndVerify(
        "smug-bob@example.com",
        "Bob",
      );
      const aliceCurrent = await changePassword(aliceHeaders, "alice second passphrase 1");
      await changePassword(bobHeaders, "bob second passphrase 1");

      // The input schema is a non-strict zod object: the unknown key is dropped, not an error.
      const context = await buildContext(aliceCurrent);
      const page = await call(auditRouter.listSelf, { userId: bobId } as never, { context });

      expect(page.rows.length).toBeGreaterThan(0);
      expect(page.rows.every((row) => row.targetId === aliceId)).toBe(true);
      expect(page.rows.some((row) => row.targetId === bobId)).toBe(false);
    });

    test("listSelf paginates and filters by action", async () => {
      const { headers } = await signUpAndVerify("page-alice@example.com", "Alice");
      const current = await changePassword(headers, "second passphrase 123");
      const other = await auth.api.signInEmail({
        body: { email: "page-alice@example.com", password: "second passphrase 123" },
        asResponse: true,
      });
      expect(other.status).toBe(200);
      await auth.api.revokeOtherSessions({ headers: current });

      const context = await buildContext(current);
      const first = await call(auditRouter.listSelf, { perPage: 1 }, { context });
      expect(first.rows).toHaveLength(1);
      expect(first.total).toBeGreaterThan(1);

      const filtered = await call(
        auditRouter.listSelf,
        {
          filters: [
            { id: "action", variant: "select", operator: "eq", value: "user.password_changed" },
          ],
        },
        { context },
      );
      expect(filtered.rows.map((row) => row.action)).toEqual(["user.password_changed"]);
    });

    test("listUser: a superadmin reads any user's rows by id; a deleted user's trail survives (R7.2)", async () => {
      const { headers: targetHeaders, userId: targetId } = await signUpAndVerify(
        "admin-target@example.com",
        "Target",
      );
      const targetCurrent = await changePassword(targetHeaders, "target second passphrase 1");
      const superContext = await superadminContext();

      const page = await call(
        auditRouter.listUser,
        { userId: targetId },
        { context: superContext },
      );
      expect(page.rows.map((row) => row.action)).toEqual(["user.password_changed"]);

      await auth.api.deleteUser({ body: {}, headers: targetCurrent });
      await auth.api.deleteUserCallback({
        query: { token: emailSender.lastDeleteAccountTokenFor("admin-target@example.com") },
        headers: targetCurrent,
      });
      const afterDelete = await call(
        auditRouter.listUser,
        { userId: targetId },
        { context: superContext },
      );
      expect(afterDelete.rows.map((row) => row.action)).toEqual([
        "user.deleted",
        "user.password_changed",
      ]);
    });

    test("listUser is forbidden to org owners and unauthenticated callers; org admins never see user rows", async () => {
      const { headers: ownerHeaders, userId: ownerId } = await signUpAndVerify(
        "iso-owner@example.com",
        "Owner",
      );
      await auth.api.createOrganization({
        body: { name: "Iso Org", slug: "iso-org" },
        headers: ownerHeaders,
      });
      const ownerCurrent = await changePassword(ownerHeaders, "owner second passphrase 1");
      const ownerContext = await buildContext(ownerCurrent);

      expect(
        await codeOf(() =>
          call(auditRouter.listUser, { userId: ownerId }, { context: ownerContext }),
        ),
      ).toBe("FORBIDDEN");
      const anonymous = await buildContext(new Headers());
      expect(
        await codeOf(() => call(auditRouter.listUser, { userId: ownerId }, { context: anonymous })),
      ).toBe("UNAUTHORIZED");
    });

    test("R7.3: user-scoped rows appear in no organization activity list and not in the platform list", async () => {
      const { headers: ownerHeaders } = await signUpAndVerify("r73-owner@example.com", "Owner");
      const org = await auth.api.createOrganization({
        body: { name: "R73 Org", slug: "r73-org" },
        headers: ownerHeaders,
      });
      if (!org) throw new Error("createOrganization returned no organization");
      const ownerCurrent = await changePassword(ownerHeaders, "owner second passphrase 1");
      await auth.api.setActiveOrganization({
        body: { organizationId: org.id },
        headers: ownerCurrent,
      });

      const orgContext = await buildContext(ownerCurrent);
      const orgPage = await call(auditRouter.list, { perPage: 100 }, { context: orgContext });
      expect(orgPage.rows.length).toBeGreaterThan(0);
      expect(orgPage.rows.every((row) => row.scope === "organization")).toBe(true);
      expect(orgPage.rows.some((row) => row.action.startsWith("user."))).toBe(false);

      const superContext = await superadminContext();
      const platformPage = await call(
        auditRouter.listPlatform,
        { perPage: 100 },
        { context: superContext },
      );
      expect(platformPage.rows.some((row) => row.scope === "user")).toBe(false);
    });
  });
});
