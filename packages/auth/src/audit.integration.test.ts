import { auditLog } from "@base-template/db/schema/audit";
import { createTestDatabase, requireTestDatabaseOrSkip } from "@base-template/db/testing";
import type { TestDatabaseHandle } from "@base-template/db/testing";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { testUtils } from "better-auth/plugins";
import type { TestHelpers } from "better-auth/plugins";

import type { AuthConfig } from "./index";
import { createAuth } from "./index";
import {
  cookieHeaderFromSetCookie,
  RecordingAuditLogger,
  RecordingEmailSender,
  resolveTestDatabaseUrl,
  signUpAndVerify as sharedSignUpAndVerify,
  TEST_PASSWORD,
  truncateAllTables,
} from "./testing";

/**
 * Integration tests for the audit log write path (docs/specs/auth-multitenant-rbac.md
 * §5, §7, R7.1, R7.2, R6.7, T5) against a real Postgres database: each R7.1
 * action must produce exactly one `audit_log` row (recorded here through a
 * `RecordingAuditLogger` fake wired into a real `createAuth` instance), with
 * the correct scope/organization/actor/target, and — separately — that the
 * real `AuditLogger` (Drizzle adapter, also wired into `createAuth`) keeps
 * organization-scoped rows readable after the organization is deleted
 * (product decision: `ON DELETE SET NULL`).
 *
 * Skips cleanly locally (fails loudly in CI) when no test database is
 * reachable (T5b).
 */
const TEST_DATABASE_URL = resolveTestDatabaseUrl();

const reachable = await requireTestDatabaseOrSkip(TEST_DATABASE_URL, "audit log write path (R7)");

describe.skipIf(!reachable)("audit log write path (R7)", () => {
  let handle: TestDatabaseHandle;
  let emailSender: RecordingEmailSender;
  let auditLogger: RecordingAuditLogger;
  let authConfig: AuthConfig;
  let auth: ReturnType<typeof createAuth>;
  let testHelpers: TestHelpers;

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
    const context = await auth.$context;
    testHelpers = (context as unknown as { test: TestHelpers }).test;
  });

  afterAll(async () => {
    await handle.close();
  });

  beforeEach(async () => {
    emailSender.reset();
    auditLogger.reset();
    await truncateAllTables(handle.db);
  });

  function signUpAndVerify(
    email: string,
    name: string,
  ): Promise<{ headers: Headers; userId: string }> {
    return sharedSignUpAndVerify(auth, emailSender, email, name);
  }

  async function ownerWithOrg(emailPrefix: string) {
    const { headers, userId } = await signUpAndVerify(`${emailPrefix}-owner@example.com`, "Owner");
    const org = await auth.api.createOrganization({
      body: { name: `${emailPrefix} Org`, slug: `${emailPrefix}-org` },
      headers,
    });
    if (!org) {
      throw new Error("createOrganization returned null");
    }
    auditLogger.reset(); // isolate the action under test from org-creation events
    return { ownerHeaders: headers, ownerId: userId, organizationId: org.id };
  }

  async function superadminHeaders(
    emailPrefix: string,
  ): Promise<{ headers: Headers; userId: string }> {
    const user = testHelpers.createUser({ role: "superadmin" });
    await testHelpers.saveUser(user);
    const { headers } = await testHelpers.login({ userId: user.id });
    void emailPrefix;
    return { headers, userId: user.id };
  }

  describe("organization events", () => {
    test("organization.created produces exactly one row (scope=organization, actor, target)", async () => {
      const { headers, userId } = await signUpAndVerify("org-created@example.com", "Owner");
      const org = await auth.api.createOrganization({
        body: { name: "Created Org", slug: "created-org" },
        headers,
      });

      const created = auditLogger.eventsFor("organization.created");
      expect(created).toHaveLength(1);
      expect(created[0]).toMatchObject({
        scope: "organization",
        organizationId: org!.id,
        actorUserId: userId,
        targetType: "organization",
        targetId: org!.id,
      });
      expect((created[0]!.metadata as Record<string, unknown>).organizationName).toBe(
        "Created Org",
      );
    });

    test("member.added is recorded for the owner self-added on organization creation", async () => {
      const { headers, userId } = await signUpAndVerify("member-added@example.com", "Owner");
      const org = await auth.api.createOrganization({
        body: { name: "Member Added Org", slug: "member-added-org" },
        headers,
      });

      const added = auditLogger.eventsFor("member.added");
      expect(added).toHaveLength(1);
      expect(added[0]).toMatchObject({
        scope: "organization",
        organizationId: org!.id,
        actorUserId: userId,
        targetType: "member",
      });
    });

    test("organization.updated produces exactly one row", async () => {
      const { ownerHeaders, organizationId } = await ownerWithOrg("org-updated");

      await auth.api.updateOrganization({
        body: { organizationId, data: { name: "Renamed Org" } },
        headers: ownerHeaders,
      });

      const updated = auditLogger.eventsFor("organization.updated");
      expect(updated).toHaveLength(1);
      expect(updated[0]).toMatchObject({
        scope: "organization",
        organizationId,
        targetType: "organization",
        targetId: organizationId,
      });
    });

    test("member.role_changed produces exactly one row with previous/new role", async () => {
      const { ownerHeaders, organizationId } = await ownerWithOrg("role-changed");
      const { userId: memberUserId } = await signUpAndVerify(
        "role-changed-member@example.com",
        "Member",
      );
      const addedMember = await testHelpers.addMember?.({
        userId: memberUserId,
        organizationId,
        role: "member",
      });
      auditLogger.reset();

      await auth.api.updateMemberRole({
        body: { memberId: (addedMember as { id: string }).id, role: "admin", organizationId },
        headers: ownerHeaders,
      });

      const roleChanged = auditLogger.eventsFor("member.role_changed");
      expect(roleChanged).toHaveLength(1);
      expect(roleChanged[0]).toMatchObject({ scope: "organization", organizationId });
      expect((roleChanged[0]!.metadata as Record<string, unknown>).previousRole).toBe("member");
      expect((roleChanged[0]!.metadata as Record<string, unknown>).newRole).toBe("admin");
    });

    test("member.removed produces exactly one row, recording the caller as actor (not the removed member)", async () => {
      const { ownerHeaders, ownerId, organizationId } = await ownerWithOrg("member-removed");
      const { userId: memberUserId } = await signUpAndVerify(
        "member-removed-member@example.com",
        "Member",
      );
      const addedMember = await testHelpers.addMember?.({
        userId: memberUserId,
        organizationId,
        role: "member",
      });
      auditLogger.reset();

      await auth.api.removeMember({
        body: { memberIdOrEmail: (addedMember as { id: string }).id, organizationId },
        headers: ownerHeaders,
      });

      const removed = auditLogger.eventsFor("member.removed");
      expect(removed).toHaveLength(1);
      expect(removed[0]).toMatchObject({
        scope: "organization",
        organizationId,
        actorUserId: ownerId,
        targetType: "member",
      });
    });

    test("member.left produces exactly one row when a member leaves on their own", async () => {
      const { organizationId } = await ownerWithOrg("member-left");
      const { headers: memberHeaders, userId: memberUserId } = await signUpAndVerify(
        "member-left-member@example.com",
        "Member",
      );
      await testHelpers.addMember?.({ userId: memberUserId, organizationId, role: "member" });
      auditLogger.reset();

      await auth.api.leaveOrganization({ body: { organizationId }, headers: memberHeaders });

      const left = auditLogger.eventsFor("member.left");
      expect(left).toHaveLength(1);
      expect(left[0]).toMatchObject({
        scope: "organization",
        organizationId,
        actorUserId: memberUserId,
        targetType: "member",
      });
    });

    test("invitation.created produces exactly one row", async () => {
      const { ownerHeaders, ownerId, organizationId } = await ownerWithOrg("invitation-created");

      const invitation = await auth.api.createInvitation({
        body: { email: "invitee@example.com", role: "member", organizationId },
        headers: ownerHeaders,
      });

      const created = auditLogger.eventsFor("invitation.created");
      expect(created).toHaveLength(1);
      expect(created[0]).toMatchObject({
        scope: "organization",
        organizationId,
        actorUserId: ownerId,
        targetType: "invitation",
        targetId: invitation!.id,
      });
    });

    test("invitation.cancelled produces exactly one row", async () => {
      const { ownerHeaders, organizationId } = await ownerWithOrg("invitation-cancelled");
      const invitation = await auth.api.createInvitation({
        body: { email: "cancel-me@example.com", role: "member", organizationId },
        headers: ownerHeaders,
      });
      auditLogger.reset();

      await auth.api.cancelInvitation({
        body: { invitationId: invitation!.id },
        headers: ownerHeaders,
      });

      const cancelled = auditLogger.eventsFor("invitation.cancelled");
      expect(cancelled).toHaveLength(1);
      expect(cancelled[0]).toMatchObject({ scope: "organization", organizationId });
    });

    test("invitation.accepted produces exactly one row (native accept-by-existing-user path)", async () => {
      const { ownerHeaders, organizationId } = await ownerWithOrg("invitation-accepted-native");
      const invitation = await auth.api.createInvitation({
        body: { email: "native-accept@example.com", role: "member", organizationId },
        headers: ownerHeaders,
      });
      const { headers: inviteeHeaders, userId: inviteeId } = await signUpAndVerify(
        "native-accept@example.com",
        "Invitee",
      );
      auditLogger.reset();

      await auth.api.acceptInvitation({
        body: { invitationId: invitation!.id },
        headers: inviteeHeaders,
      });

      const accepted = auditLogger.eventsFor("invitation.accepted");
      expect(accepted).toHaveLength(1);
      expect(accepted[0]).toMatchObject({
        scope: "organization",
        organizationId,
        actorUserId: inviteeId,
        targetType: "invitation",
        targetId: invitation!.id,
      });
    });

    test("invitation.accepted produces exactly one row for the custom sign-up-via-invitation path (R2.4)", async () => {
      const { ownerHeaders, organizationId } = await ownerWithOrg("invitation-accepted-signup");
      const email = "signup-accept@example.com";
      const invitation = await auth.api.createInvitation({
        body: { email, role: "member", organizationId },
        headers: ownerHeaders,
      });
      const token = emailSender.lastInvitationTokenFor(email);
      auditLogger.reset();

      const response = await auth.api.signUpViaInvitation({
        body: { invitationId: invitation!.id, token, name: "New Invitee", password: TEST_PASSWORD },
        asResponse: true,
      });
      expect(response.status).toBe(200);
      const newUser = (await response.clone().json()) as { user: { id: string } };

      const accepted = auditLogger.eventsFor("invitation.accepted");
      expect(accepted).toHaveLength(1);
      expect(accepted[0]).toMatchObject({
        scope: "organization",
        organizationId,
        actorUserId: newUser.user.id,
        targetType: "invitation",
        targetId: invitation!.id,
      });
    });

    test("invitation.rejected produces exactly one row", async () => {
      const { ownerHeaders, organizationId } = await ownerWithOrg("invitation-rejected");
      const invitation = await auth.api.createInvitation({
        body: { email: "reject-me@example.com", role: "member", organizationId },
        headers: ownerHeaders,
      });
      const { headers: inviteeHeaders, userId: inviteeId } = await signUpAndVerify(
        "reject-me@example.com",
        "Invitee",
      );
      auditLogger.reset();

      await auth.api.rejectInvitation({
        body: { invitationId: invitation!.id },
        headers: inviteeHeaders,
      });

      const rejected = auditLogger.eventsFor("invitation.rejected");
      expect(rejected).toHaveLength(1);
      expect(rejected[0]).toMatchObject({
        scope: "organization",
        organizationId,
        actorUserId: inviteeId,
        targetType: "invitation",
        targetId: invitation!.id,
      });
    });

    test("role.created / role.updated / role.deleted each produce exactly one row", async () => {
      const { ownerHeaders, ownerId, organizationId } = await ownerWithOrg("role-crud");

      const createdRole = await auth.api.createOrgRole({
        body: { organizationId, role: "billing-manager", permission: { project: ["read"] } },
        headers: ownerHeaders,
      });
      expect(auditLogger.eventsFor("role.created")).toHaveLength(1);
      expect(auditLogger.eventsFor("role.created")[0]).toMatchObject({
        scope: "organization",
        organizationId,
        actorUserId: ownerId,
        targetType: "organizationRole",
      });

      await auth.api.updateOrgRole({
        body: {
          organizationId,
          roleName: "billing-manager",
          data: { permission: { project: ["read", "update"] } },
        },
        headers: ownerHeaders,
      });
      expect(auditLogger.eventsFor("role.updated")).toHaveLength(1);

      await auth.api.deleteOrgRole({
        body: { organizationId, roleName: "billing-manager" },
        headers: ownerHeaders,
      });
      expect(auditLogger.eventsFor("role.deleted")).toHaveLength(1);
      void createdRole;
    });

    test("impersonated action records the impersonator alongside the acting user (R6.4, R7.2)", async () => {
      const { organizationId } = await ownerWithOrg("impersonated-action");
      const { userId: memberUserId } = await signUpAndVerify(
        "impersonated-member@example.com",
        "Member",
      );
      await testHelpers.addMember?.({ userId: memberUserId, organizationId, role: "admin" });
      const { headers: superadminHeadersValue, userId: superadminId } =
        await superadminHeaders("impersonated-action");
      auditLogger.reset();

      const impersonation = await auth.api.impersonateUser({
        body: { userId: memberUserId },
        headers: superadminHeadersValue,
        asResponse: true,
      });
      const impersonatedHeaders = cookieHeaderFromSetCookie(
        impersonation.headers.get("set-cookie"),
      );
      auditLogger.reset(); // isolate from user.impersonation_started

      await auth.api.updateOrganization({
        body: { organizationId, data: { name: "Renamed While Impersonated" } },
        headers: impersonatedHeaders,
      });

      const updated = auditLogger.eventsFor("organization.updated");
      expect(updated).toHaveLength(1);
      expect(updated[0]).toMatchObject({
        actorUserId: memberUserId,
        impersonatorUserId: superadminId,
      });
    });

    test("deleting an organization keeps its audit rows with organizationId NULL and readable metadata", async () => {
      // Uses the REAL Drizzle-backed audit logger (via a second auth instance
      // sharing the same DB), so the FK/CHECK behavior is exercised for real.
      const { createDrizzleAuditLogger } = await import("./audit/drizzle-adapter");
      const realAuditLogger = createDrizzleAuditLogger(handle.db);
      const realAuth = createAuth(authConfig, handle.db, emailSender, realAuditLogger, {
        extraPlugins: [testUtils()],
      });
      const realContext = await realAuth.$context;
      const realTestHelpers = (realContext as unknown as { test: TestHelpers }).test;

      const { headers, userId } = await sharedSignUpAndVerify(
        realAuth,
        emailSender,
        "delete-org-owner@example.com",
        "Owner",
      );
      const org = await realAuth.api.createOrganization({
        body: { name: "Doomed Org", slug: "doomed-org" },
        headers,
      });
      void realTestHelpers;
      void userId;

      await realAuth.api.deleteOrganization({
        body: { organizationId: org!.id },
        headers,
      });

      const rows = await handle.db
        .select()
        .from(auditLog)
        .where(eq(auditLog.action, "organization.deleted"));
      expect(rows).toHaveLength(1);
      const row = rows[0]!;
      expect(row.organizationId).toBeNull();
      expect((row.metadata as Record<string, unknown>).organizationName).toBe("Doomed Org");
    });
  });

  describe("platform events", () => {
    test("user.banned / user.unbanned each produce exactly one row", async () => {
      const { userId: targetUserId } = await signUpAndVerify("ban-target@example.com", "Target");
      const { headers: superadminHeadersValue } = await superadminHeaders("ban");
      auditLogger.reset();

      await auth.api.banUser({
        body: { userId: targetUserId, banReason: "spam" },
        headers: superadminHeadersValue,
      });
      const banned = auditLogger.eventsFor("user.banned");
      expect(banned).toHaveLength(1);
      expect(banned[0]).toMatchObject({
        scope: "platform",
        targetType: "user",
        targetId: targetUserId,
      });
      expect(banned[0]!.organizationId).toBeUndefined();

      await auth.api.unbanUser({ body: { userId: targetUserId }, headers: superadminHeadersValue });
      expect(auditLogger.eventsFor("user.unbanned")).toHaveLength(1);
    });

    test("user.platform_role_changed produces exactly one row via /admin/set-role", async () => {
      const { userId: targetUserId } = await signUpAndVerify(
        "role-change-target@example.com",
        "Target",
      );
      const { headers: superadminHeadersValue } = await superadminHeaders("role-change");
      auditLogger.reset();

      await auth.api.setRole({
        body: { userId: targetUserId, role: "superadmin" },
        headers: superadminHeadersValue,
      });

      const changed = auditLogger.eventsFor("user.platform_role_changed");
      expect(changed).toHaveLength(1);
      expect(changed[0]).toMatchObject({ scope: "platform", targetId: targetUserId });
    });

    test("user.org_limit_changed produces exactly one row via /admin/update-user", async () => {
      const { userId: targetUserId } = await signUpAndVerify(
        "org-limit-target@example.com",
        "Target",
      );
      const { headers: superadminHeadersValue } = await superadminHeaders("org-limit");
      auditLogger.reset();

      await auth.api.adminUpdateUser({
        body: { userId: targetUserId, data: { maxOrganizations: 7 } },
        headers: superadminHeadersValue,
      });

      const changed = auditLogger.eventsFor("user.org_limit_changed");
      expect(changed).toHaveLength(1);
      expect(changed[0]).toMatchObject({ scope: "platform", targetId: targetUserId });
      expect((changed[0]!.metadata as Record<string, unknown>).newMaxOrganizations).toBe(7);
    });

    test("user.impersonation_started / user.impersonation_stopped each produce exactly one row", async () => {
      const { userId: targetUserId } = await signUpAndVerify(
        "impersonation-target@example.com",
        "Target",
      );
      const { headers: superadminHeadersValue, userId: superadminId } =
        await superadminHeaders("impersonation");
      auditLogger.reset();

      const impersonation = await auth.api.impersonateUser({
        body: { userId: targetUserId },
        headers: superadminHeadersValue,
        asResponse: true,
      });
      const started = auditLogger.eventsFor("user.impersonation_started");
      expect(started).toHaveLength(1);
      expect(started[0]).toMatchObject({
        scope: "platform",
        actorUserId: superadminId,
        targetId: targetUserId,
      });

      const impersonatedHeaders = cookieHeaderFromSetCookie(
        impersonation.headers.get("set-cookie"),
      );
      auditLogger.reset();

      await auth.api.stopImpersonating({
        headers: impersonatedHeaders,
      });
      const stopped = auditLogger.eventsFor("user.impersonation_stopped");
      expect(stopped).toHaveLength(1);
      expect(stopped[0]).toMatchObject({
        scope: "platform",
        actorUserId: superadminId,
        targetId: targetUserId,
        impersonatorUserId: null,
      });
    });
  });
});
