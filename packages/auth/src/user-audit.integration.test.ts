import { auditLog } from "@base-template/db/schema/audit";
import * as schema from "@base-template/db/schema";
import { createTestDatabase, requireTestDatabaseOrSkip } from "@base-template/db/testing";
import type { TestDatabaseHandle } from "@base-template/db/testing";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { and, asc, eq } from "drizzle-orm";

import { createDrizzleAuditLogger } from "./audit/drizzle-adapter";
import type { AuditEvent, AuditLogger } from "./audit/types";
import { createAuth } from "./index";
import {
  cookieHeaderFromSetCookie,
  RecordingEmailSender,
  resolveTestDatabaseUrl,
  signUpAndVerify as sharedSignUpAndVerify,
  TEST_PASSWORD,
  truncateAllTables,
} from "./testing";

/**
 * Integration tests for the user-scoped audit trail (docs/specs/account-and-org-settings.md R2.4,
 * R3.5, R4.2, R4.3, R6.4, R7.3), written through the real Drizzle audit logger.
 */
const reachable = await requireTestDatabaseOrSkip(
  resolveTestDatabaseUrl(),
  "user audit integration (R2.4, R3.5, R4, R6.4, R7.3)",
);

const APP_ORIGIN = "http://localhost:3001";
const NEW_PASSWORD = "a brand new passphrase 123";

describe.skipIf(!reachable)("user audit integration (R2.4, R3.5, R4, R6.4, R7.3)", () => {
  let handle: TestDatabaseHandle;
  let emailSender: RecordingEmailSender;
  let auth: ReturnType<typeof createAuth>;
  const control = { failUserDeleted: false };

  beforeAll(() => {
    handle = createTestDatabase(resolveTestDatabaseUrl());
    emailSender = new RecordingEmailSender();
    const real = createDrizzleAuditLogger(handle.db);
    const auditLogger: AuditLogger = {
      record: (event: AuditEvent) =>
        control.failUserDeleted && event.action === "user.deleted"
          ? Promise.reject(new Error("simulated audit write failure"))
          : real.record(event),
    };
    // No `accountSecurityEvents`: the production default wires the audit trail.
    auth = createAuth(
      {
        BETTER_AUTH_URL: "http://localhost:3000",
        BETTER_AUTH_SECRET: "a-32-character-long-test-secret",
        CORS_ORIGIN: APP_ORIGIN,
        DEFAULT_MAX_ORGS_PER_USER: 5,
      },
      handle.db,
      emailSender,
      auditLogger,
    );
  });

  afterAll(async () => {
    await handle.close();
  });

  beforeEach(async () => {
    emailSender.reset();
    control.failUserDeleted = false;
    await truncateAllTables(handle.db);
  });

  function signUpAndVerify(email: string, name: string) {
    return sharedSignUpAndVerify(auth, emailSender, email, name);
  }

  async function signIn(email: string, userAgent: string, password = TEST_PASSWORD) {
    const response = await auth.api.signInEmail({
      body: { email, password },
      headers: new Headers({ "user-agent": userAgent, "x-forwarded-for": "203.0.113.7" }),
      asResponse: true,
    });
    expect(response.status).toBe(200);
    return cookieHeaderFromSetCookie(response.headers.get("set-cookie"));
  }

  async function userRows(action?: string) {
    const where = action
      ? and(eq(auditLog.scope, "user"), eq(auditLog.action, action))
      : eq(auditLog.scope, "user");
    return handle.db.select().from(auditLog).where(where).orderBy(asc(auditLog.createdAt));
  }

  test("sign-up verification records nothing: only a completed change records email_changed", async () => {
    await signUpAndVerify("quiet@example.com", "Quiet");

    expect(await userRows()).toEqual([]);
  });

  test("R2.4: a completed email change records user.email_changed with old and new address", async () => {
    const { headers, userId } = await signUpAndVerify("old@example.com", "Mover");
    await auth.api.changeEmail({ body: { newEmail: "new@example.com" }, headers });
    await auth.api.verifyEmail({
      query: { token: emailSender.lastChangeEmailApprovalTokenFor("old@example.com") },
      headers,
    });
    // Approval alone changes nothing, so nothing is recorded yet.
    expect(await userRows()).toEqual([]);

    await auth.api.verifyEmail({
      query: { token: emailSender.lastVerificationTokenFor("new@example.com") },
      headers,
    });

    const rows = await userRows("user.email_changed");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      scope: "user",
      organizationId: null,
      actorUserId: userId,
      targetType: "user",
      targetId: userId,
    });
    expect(rows[0]?.metadata).toMatchObject({
      oldEmail: "old@example.com",
      newEmail: "new@example.com",
      actorEmail: "new@example.com",
    });
  });

  test("R3.5: change and reset password record user.password_changed / user.password_reset", async () => {
    const { headers, userId } = await signUpAndVerify("pw@example.com", "Pw");

    await auth.api.changePassword({
      body: { currentPassword: TEST_PASSWORD, newPassword: NEW_PASSWORD },
      headers,
    });
    await auth.api.requestPasswordReset({
      body: { email: "pw@example.com", redirectTo: `${APP_ORIGIN}/reset-password` },
    });
    await auth.api.resetPassword({
      body: {
        token: emailSender.lastResetPasswordTokenFor("pw@example.com"),
        newPassword: "yet another passphrase 456",
      },
    });

    const changed = await userRows("user.password_changed");
    const reset = await userRows("user.password_reset");
    expect(changed).toHaveLength(1);
    expect(reset).toHaveLength(1);
    for (const row of [...changed, ...reset]) {
      expect(row).toMatchObject({
        scope: "user",
        organizationId: null,
        actorUserId: userId,
        targetType: "user",
        targetId: userId,
      });
      expect(row.metadata).toMatchObject({ actorEmail: "pw@example.com" });
      expect(JSON.stringify(row.metadata)).not.toContain("passphrase");
    }
  });

  test("a failed password change records nothing", async () => {
    const { headers } = await signUpAndVerify("nope@example.com", "Nope");

    await expect(
      auth.api.changePassword({
        body: { currentPassword: "not the password", newPassword: NEW_PASSWORD },
        headers,
      }),
    ).rejects.toThrow();

    expect(await userRows()).toEqual([]);
  });

  describe("R4 session revocation", () => {
    test("R4.2: revoking one session records one row with safe session info and no token", async () => {
      const { headers, userId } = await signUpAndVerify("one@example.com", "One");
      const other = await signIn("one@example.com", "OtherBrowser/2.0");
      const otherSession = (await auth.api.getSession({ headers: other }))?.session;
      if (!otherSession) throw new Error("expected a second session");

      await auth.api.revokeSession({ body: { token: otherSession.token }, headers });

      const rows = await userRows("user.session_revoked");
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        scope: "user",
        organizationId: null,
        actorUserId: userId,
        targetType: "user",
        targetId: userId,
      });
      expect(rows[0]?.metadata).toMatchObject({
        actorEmail: "one@example.com",
        sessionId: otherSession.id,
        sessionUserAgent: "OtherBrowser/2.0",
        sessionIp: "203.0.113.7",
      });
      expect(JSON.stringify(rows[0])).not.toContain(otherSession.token);
    });

    test("R4.3: revoking all other sessions records one row per revoked session", async () => {
      const { headers } = await signUpAndVerify("many@example.com", "Many");
      await signIn("many@example.com", "Agent/1");
      await signIn("many@example.com", "Agent/2");

      await auth.api.revokeOtherSessions({ headers });

      const rows = await userRows("user.session_revoked");
      expect(
        rows
          .map((row) => (row.metadata as { sessionUserAgent: string }).sessionUserAgent)
          .toSorted(),
      ).toEqual(["Agent/1", "Agent/2"]);
    });

    test("revoking every session records one row per session, the current one included", async () => {
      const { headers } = await signUpAndVerify("all@example.com", "All");
      await signIn("all@example.com", "Agent/1");

      await auth.api.revokeSessions({ headers });

      expect(await userRows("user.session_revoked")).toHaveLength(2);
    });

    test("a refused or foreign revoke records nothing", async () => {
      const { headers } = await signUpAndVerify("guard@example.com", "Guard");
      await signUpAndVerify("victim@example.com", "Victim");
      const victim = await signIn("victim@example.com", "Victim/1");
      const victimToken = (await auth.api.getSession({ headers: victim }))?.session.token ?? "";
      const currentToken = (await auth.api.getSession({ headers }))?.session.token ?? "";

      await expect(
        auth.api.revokeSession({ body: { token: currentToken }, headers }),
      ).rejects.toThrow();
      await auth.api.revokeSession({ body: { token: victimToken }, headers });

      expect(await userRows()).toEqual([]);
    });

    test("password change auto-revocations are not recorded as session_revoked", async () => {
      const { headers } = await signUpAndVerify("auto@example.com", "Auto");
      await signIn("auto@example.com", "Agent/1");

      await auth.api.changePassword({
        body: { currentPassword: TEST_PASSWORD, newPassword: NEW_PASSWORD },
        headers,
      });

      expect(await userRows("user.session_revoked")).toEqual([]);
      expect(await userRows("user.password_changed")).toHaveLength(1);
    });
  });

  describe("R6.4 account deletion", () => {
    async function requestDeletion(email: string, name: string) {
      const { headers, userId } = await signUpAndVerify(email, name);
      await auth.api.deleteUser({ body: {}, headers });
      const token = emailSender.lastDeleteAccountTokenFor(email);
      return { headers, userId, token };
    }

    test("user.deleted is written before the delete and survives it", async () => {
      const { headers, userId, token } = await requestDeletion("bye@example.com", "Bye");

      await auth.api.deleteUserCallback({ query: { token }, headers });

      const rows = await userRows("user.deleted");
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        scope: "user",
        organizationId: null,
        // The actor reference is nulled by ON DELETE SET NULL; the target id and snapshot remain.
        actorUserId: null,
        targetType: "user",
        targetId: userId,
      });
      expect(rows[0]?.metadata).toMatchObject({ actorEmail: "bye@example.com", userName: "Bye" });
      const remaining = await handle.db
        .select()
        .from(schema.user)
        .where(eq(schema.user.id, userId));
      expect(remaining).toEqual([]);
    });

    test("a failed audit write aborts the deletion", async () => {
      const { headers, userId, token } = await requestDeletion("stay@example.com", "Stay");
      control.failUserDeleted = true;

      await expect(auth.api.deleteUserCallback({ query: { token }, headers })).rejects.toThrow();

      const remaining = await handle.db
        .select()
        .from(schema.user)
        .where(eq(schema.user.id, userId));
      expect(remaining).toHaveLength(1);
      expect(await userRows("user.deleted")).toEqual([]);
    });
  });
});
