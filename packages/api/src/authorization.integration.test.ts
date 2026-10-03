import type { AuthConfig } from "@base-template/auth";
import { createAuth } from "@base-template/auth";
import {
  RecordingAuditLogger,
  RecordingEmailSender,
  resolveTestDatabaseUrl,
  signUpAndVerify as sharedSignUpAndVerify,
  truncateAllTables,
} from "@base-template/auth/testing";
import { createTestDatabase, requireTestDatabaseOrSkip } from "@base-template/db/testing";
import type { TestDatabaseHandle } from "@base-template/db/testing";
import { call, ORPCError } from "@orpc/server";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { testUtils } from "better-auth/plugins";
import type { TestHelpers } from "better-auth/plugins";

import { createBetterAuthAuthorization } from "./authorization";
import type { Context } from "./context";
import { createBetterAuthPlatformAdmin } from "./platform-admin";
import { projectRouter, resetProjectsForTests } from "./routers/project";

/**
 * Integration tests for the oRPC authorization port against a real Postgres
 * database (docs/specs/auth-multitenant-rbac.md §4.5, R4, R5, R6.5), using
 * `createBetterAuthAuthorization` wired to a real `createAuth` instance —
 * the same adapter `apps/server` uses in production.
 *
 * Follows the setup patterns of `@base-template/auth`'s own
 * `auth.integration.test.ts`, sharing the recording `EmailSender`,
 * sign-up-then-verify flow, and table truncation from `@base-template/auth/testing`
 * (T3.1g). Skips cleanly (does not fail) when no test database is reachable.
 */
const TEST_DATABASE_URL = resolveTestDatabaseUrl();

const reachable = await requireTestDatabaseOrSkip(
  TEST_DATABASE_URL,
  "createBetterAuthAuthorization integration (R4, R5, R6.5)",
);

describe.skipIf(!reachable)("createBetterAuthAuthorization integration (R4, R5, R6.5)", () => {
  let handle: TestDatabaseHandle;
  let emailSender: RecordingEmailSender;
  let auditLogger: RecordingAuditLogger;
  let auth: ReturnType<typeof createAuth>;
  let testHelpers: TestHelpers;
  let authConfig: AuthConfig;

  beforeAll(async () => {
    handle = createTestDatabase(TEST_DATABASE_URL);
    emailSender = new RecordingEmailSender();
    auditLogger = new RecordingAuditLogger();
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
    auditLogger.reset();
    resetProjectsForTests();
    await truncateAllTables(handle.db);
  });

  /** Signs a user up and verifies them via the captured email link, returning authenticated request headers. */
  function signUpAndVerify(
    email: string,
    name: string,
  ): Promise<{ headers: Headers; userId: string }> {
    return sharedSignUpAndVerify(auth, emailSender, email, name);
  }

  /** Builds a real oRPC `Context` for `headers`, mirroring `apps/server/src/context.ts`. */
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
      actingTokenSecret: "test-acting-token-secret-0000000",
    };
  }

  test("a custom dynamic role granting only project:read can list projects but not create one (R4)", async () => {
    const { headers: ownerHeaders } = await signUpAndVerify("dyn-owner@example.com", "Owner");
    const org = await auth.api.createOrganization({
      body: { name: "Dynamic Roles Org", slug: "dynamic-roles-org" },
      headers: ownerHeaders,
    });
    if (!org) {
      throw new Error("createOrganization returned no organization");
    }

    await auth.api.createOrgRole({
      headers: ownerHeaders,
      body: { role: "project-reader", permission: { project: ["read"] } },
    });

    const { userId: readerUserId } = await signUpAndVerify("dyn-reader@example.com", "Reader");
    await testHelpers.addMember?.({
      userId: readerUserId,
      organizationId: org.id,
      role: "project-reader",
    });
    const { headers: readerHeaders } = await testHelpers.login({
      userId: readerUserId,
      session: { activeOrganizationId: org.id },
    });

    const context = await buildContext(readerHeaders);

    const listResult = await call(projectRouter.list, undefined, { context });
    expect(listResult).toEqual([]);

    let createError: unknown;
    try {
      await call(projectRouter.create, { name: "Should be denied" }, { context });
    } catch (error) {
      createError = error;
    }
    expect(createError).toBeInstanceOf(ORPCError);
    expect((createError as ORPCError<string, unknown>).code).toBe("FORBIDDEN");
  });

  test("project data is always scoped by the caller's active organization, never by client input (R5.1)", async () => {
    const { headers: ownerAHeaders } = await signUpAndVerify("iso-owner-a@example.com", "Owner A");
    const orgA = await auth.api.createOrganization({
      body: { name: "Isolation Org A", slug: "isolation-org-a" },
      headers: ownerAHeaders,
    });
    const { headers: ownerBHeaders } = await signUpAndVerify("iso-owner-b@example.com", "Owner B");
    const orgB = await auth.api.createOrganization({
      body: { name: "Isolation Org B", slug: "isolation-org-b" },
      headers: ownerBHeaders,
    });
    if (!orgA || !orgB) {
      throw new Error("createOrganization returned no organization");
    }

    const contextA = await buildContext(ownerAHeaders);

    // A malicious/buggy client trying to smuggle another organization's id
    // into the input must not affect which organization the record is
    // scoped to: `project.create`'s input schema only declares `name`, and
    // the handler reads `context.org.id`, which orgProcedure derived from
    // the session's own membership — never from this input.
    const maliciousInput = { name: "Org A project", organizationId: orgB.id } as unknown as {
      name: string;
    };
    const created = await call(projectRouter.create, maliciousInput, { context: contextA });
    expect(created.organizationId).toBe(orgA.id);
    expect(created.organizationId).not.toBe(orgB.id);

    const listA = await call(projectRouter.list, undefined, { context: contextA });
    expect(listA).toEqual([created]);

    const contextB = await buildContext(ownerBHeaders);
    const listB = await call(projectRouter.list, undefined, { context: contextB });
    expect(listB).toEqual([]);
  });

  test("a built-in `member` role can read but not create projects (R5.1)", async () => {
    const { headers: ownerHeaders } = await signUpAndVerify("member-owner@example.com", "Owner");
    const org = await auth.api.createOrganization({
      body: { name: "Member Role Org", slug: "member-role-org" },
      headers: ownerHeaders,
    });
    if (!org) {
      throw new Error("createOrganization returned no organization");
    }

    const { userId: memberUserId } = await signUpAndVerify("member-user@example.com", "Member");
    await testHelpers.addMember?.({ userId: memberUserId, organizationId: org.id, role: "member" });
    const { headers: memberHeaders } = await testHelpers.login({
      userId: memberUserId,
      session: { activeOrganizationId: org.id },
    });
    const context = await buildContext(memberHeaders);

    const listResult = await call(projectRouter.list, undefined, { context });
    expect(listResult).toEqual([]);

    let createError: unknown;
    try {
      await call(projectRouter.create, { name: "Should be denied" }, { context });
    } catch (error) {
      createError = error;
    }
    expect(createError).toBeInstanceOf(ORPCError);
    expect((createError as ORPCError<string, unknown>).code).toBe("FORBIDDEN");
  });

  test("a custom role created in organization A is neither listed nor assignable in organization B (R4.7)", async () => {
    const { headers: ownerAHeaders } = await signUpAndVerify("r47-owner-a@example.com", "Owner A");
    const orgA = await auth.api.createOrganization({
      body: { name: "R4.7 Org A", slug: "r47-org-a" },
      headers: ownerAHeaders,
    });
    const { headers: ownerBHeaders } = await signUpAndVerify("r47-owner-b@example.com", "Owner B");
    const orgB = await auth.api.createOrganization({
      body: { name: "R4.7 Org B", slug: "r47-org-b" },
      headers: ownerBHeaders,
    });
    if (!orgA || !orgB) {
      throw new Error("createOrganization returned no organization");
    }

    await auth.api.createOrgRole({
      headers: ownerAHeaders,
      body: {
        organizationId: orgA.id,
        role: "org-a-only-role",
        permission: { project: ["read"] },
      },
    });

    // R4.7 (list): org B's own role list never contains org A's custom
    // role. `/organization/list-roles` is scoped by a WHERE-clause on
    // `organizationId`, not filtered client-side, so this exercises the
    // real DB-level tenant boundary rather than a mock.
    const orgBRoles = await auth.api.listOrgRoles({
      headers: ownerBHeaders,
      query: { organizationId: orgB.id },
    });
    expect(orgBRoles.map((role) => role.role)).not.toContain("org-a-only-role");

    // R4.7 (cross-org probe): owner B explicitly asking for org A's roles is
    // refused. better-auth resolves the caller's membership in the REQUESTED
    // organization before reading roles, so a non-member gets FORBIDDEN
    // rather than org A's role list.
    await expect(
      auth.api.listOrgRoles({
        headers: ownerBHeaders,
        query: { organizationId: orgA.id },
      }),
    ).rejects.toMatchObject({
      status: "FORBIDDEN",
      body: { code: "YOU_ARE_NOT_A_MEMBER_OF_THIS_ORGANIZATION" },
    });

    // R4.7 (assign): assigning org A's role name to a member of org B is
    // refused. `/organization/update-member-role` resolves an unrecognized
    // role name against `organizationRole` scoped to the TARGET
    // organization's id (verified against the installed better-auth 1.7.5
    // source, `dist/plugins/organization/routes/crud-members.mjs`) — a role
    // that only exists for org A is indistinguishable from a role that
    // doesn't exist at all, and the request fails closed with
    // `ROLE_NOT_FOUND`, not `FORBIDDEN`.
    const { userId: memberBUserId } = await signUpAndVerify("r47-member-b@example.com", "Member B");
    if (!testHelpers.addMember) {
      throw new Error("testUtils helpers are missing addMember");
    }
    const memberB = await testHelpers.addMember({
      userId: memberBUserId,
      organizationId: orgB.id,
      role: "member",
    });
    if (typeof memberB.id !== "string") {
      throw new Error("addMember returned a member without an id");
    }

    await expect(
      auth.api.updateMemberRole({
        headers: ownerBHeaders,
        body: {
          memberId: memberB.id,
          role: "org-a-only-role",
          organizationId: orgB.id,
        },
      }),
    ).rejects.toMatchObject({
      status: "BAD_REQUEST",
      body: { code: "ROLE_NOT_FOUND" },
    });
  });
});
