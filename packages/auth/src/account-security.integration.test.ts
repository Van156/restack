import * as schema from "@base-template/db/schema";
import { createTestDatabase, requireTestDatabaseOrSkip } from "@base-template/db/testing";
import type { TestDatabaseHandle } from "@base-template/db/testing";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { APIError } from "better-auth";
import { eq } from "drizzle-orm";

import type { AccountSecurityEvents } from "./account-security";
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
 * Integration tests for the account-security wiring of `createAuth`
 * (docs/specs/account-and-org-settings.md R2, R3, R4, R6). Option names and hook shapes were
 * verified against the installed better-auth 1.7.5 source; see the decision record in
 * odd/tasks/account-settings.md.
 */
const reachable = await requireTestDatabaseOrSkip(
  resolveTestDatabaseUrl(),
  "account security integration (R2, R3, R4, R6)",
);

const NEW_PASSWORD = "a brand new passphrase 123";
const APP_ORIGIN = "http://localhost:3001";

/** Runs `action` and returns the `APIError` it rejects with (fails the test when it resolves). */
async function rejection(action: Promise<unknown>): Promise<APIError> {
  try {
    await action;
  } catch (error) {
    if (error instanceof APIError) {
      return error;
    }
    throw error;
  }
  throw new Error("expected the call to reject with an APIError");
}

describe.skipIf(!reachable)("account security integration (R2, R3, R4, R6)", () => {
  let handle: TestDatabaseHandle;
  let emailSender: RecordingEmailSender;
  let auth: ReturnType<typeof createAuth>;
  const events = {
    passwordChanged: [] as Array<{ userId: string; email: string }>,
    passwordReset: [] as Array<{ userId: string; email: string }>,
    userDeleting: [] as Array<{ userId: string; email: string; name: string }>,
    failUserDeleting: false,
  };

  beforeAll(() => {
    handle = createTestDatabase(resolveTestDatabaseUrl());
    emailSender = new RecordingEmailSender();
    const accountSecurityEvents: AccountSecurityEvents = {
      passwordChanged: (event) => {
        events.passwordChanged.push(event);
        return Promise.resolve();
      },
      passwordReset: (event) => {
        events.passwordReset.push(event);
        return Promise.resolve();
      },
      userDeleting: (event) => {
        if (events.failUserDeleting) {
          return Promise.reject(new Error("simulated audit write failure"));
        }
        events.userDeleting.push(event);
        return Promise.resolve();
      },
    };
    auth = createAuth(
      {
        BETTER_AUTH_URL: "http://localhost:3000",
        BETTER_AUTH_SECRET: "a-32-character-long-test-secret",
        CORS_ORIGIN: APP_ORIGIN,
        DEFAULT_MAX_ORGS_PER_USER: 5,
      },
      handle.db,
      emailSender,
      new RecordingAuditLogger(),
      { accountSecurityEvents },
    );
  });

  afterAll(async () => {
    await handle.close();
  });

  beforeEach(async () => {
    emailSender.reset();
    events.passwordChanged.length = 0;
    events.passwordReset.length = 0;
    events.userDeleting.length = 0;
    events.failUserDeleting = false;
    await truncateAllTables(handle.db);
  });

  function signUpAndVerify(email: string, name: string) {
    return sharedSignUpAndVerify(auth, emailSender, email, name);
  }

  /** Opens another session for an existing user (a second "device"). */
  async function signIn(email: string, password = TEST_PASSWORD): Promise<Headers> {
    const response = await auth.api.signInEmail({
      body: { email, password },
      asResponse: true,
    });
    expect(response.status).toBe(200);
    return cookieHeaderFromSetCookie(response.headers.get("set-cookie"));
  }

  async function hasSession(headers: Headers): Promise<boolean> {
    return (await auth.api.getSession({ headers })) !== null;
  }

  async function userEmail(userId: string): Promise<string | undefined> {
    const [row] = await handle.db
      .select({ email: schema.user.email })
      .from(schema.user)
      .where(eq(schema.user.id, userId));
    return row?.email;
  }

  describe("R3.2 forgot password", () => {
    test("responds identically for a known and an unknown address; mails only the known one", async () => {
      await signUpAndVerify("known@example.com", "Known");

      const known = await auth.api.requestPasswordReset({
        body: { email: "known@example.com", redirectTo: `${APP_ORIGIN}/reset-password` },
      });
      const unknown = await auth.api.requestPasswordReset({
        body: { email: "nobody@example.com", redirectTo: `${APP_ORIGIN}/reset-password` },
      });

      expect(known).toEqual(unknown);
      expect(emailSender.resetPasswords).toHaveLength(1);
      expect(emailSender.resetPasswords[0]?.to).toBe("known@example.com");
    });
  });

  describe("R3.2 forgot password with a failing mail provider", () => {
    test("a failed reset email for a known address answers like an unknown address", async () => {
      await signUpAndVerify("known-flaky@example.com", "Known");
      const unknown = await auth.api.requestPasswordReset({
        body: { email: "nobody@example.com", redirectTo: `${APP_ORIGIN}/reset-password` },
      });
      emailSender.sendResetPassword = () => Promise.reject(new Error("smtp down"));

      try {
        const known = await auth.api.requestPasswordReset({
          body: { email: "known-flaky@example.com", redirectTo: `${APP_ORIGIN}/reset-password` },
        });
        expect(known).toEqual(unknown);
      } finally {
        delete (emailSender as { sendResetPassword?: unknown }).sendResetPassword;
      }
    });
  });

  describe("R3.3 / R3.5 reset password", () => {
    test("a valid token sets the new password once, revokes sessions and sends the notice", async () => {
      const { headers, userId } = await signUpAndVerify("reset@example.com", "Reset");
      const otherDevice = await signIn("reset@example.com");
      await auth.api.requestPasswordReset({
        body: { email: "reset@example.com", redirectTo: `${APP_ORIGIN}/reset-password` },
      });
      const token = emailSender.lastResetPasswordTokenFor("reset@example.com");

      await auth.api.resetPassword({ body: { token, newPassword: NEW_PASSWORD } });

      await signIn("reset@example.com", NEW_PASSWORD);
      expect(await hasSession(headers)).toBe(false);
      expect(await hasSession(otherDevice)).toBe(false);
      expect(emailSender.passwordChangedNotices).toHaveLength(1);
      expect(emailSender.passwordChangedNotices[0]?.to).toBe("reset@example.com");
      expect(events.passwordReset).toEqual([{ userId, email: "reset@example.com" }]);

      const reused = await rejection(
        auth.api.resetPassword({ body: { token, newPassword: "another passphrase 456" } }),
      );
      expect(reused.statusCode).toBe(400);
      expect(emailSender.passwordChangedNotices).toHaveLength(1);
    });

    test("an unknown token fails and sends no notice", async () => {
      const failure = await rejection(
        auth.api.resetPassword({ body: { token: "nope", newPassword: NEW_PASSWORD } }),
      );

      expect(failure.statusCode).toBe(400);
      expect(emailSender.passwordChangedNotices).toHaveLength(0);
      expect(events.passwordReset).toHaveLength(0);
    });

    test("a failing notice email does not undo the reset: it succeeds and sessions are revoked", async () => {
      const { headers } = await signUpAndVerify("flaky@example.com", "Flaky");
      const otherDevice = await signIn("flaky@example.com");
      await auth.api.requestPasswordReset({
        body: { email: "flaky@example.com", redirectTo: `${APP_ORIGIN}/reset-password` },
      });
      const token = emailSender.lastResetPasswordTokenFor("flaky@example.com");
      emailSender.sendPasswordChangedNotice = () => Promise.reject(new Error("smtp down"));

      try {
        const result = await auth.api.resetPassword({ body: { token, newPassword: NEW_PASSWORD } });
        expect(result).toEqual({ status: true });
      } finally {
        delete (emailSender as { sendPasswordChangedNotice?: unknown }).sendPasswordChangedNotice;
      }

      expect(await hasSession(headers)).toBe(false);
      expect(await hasSession(otherDevice)).toBe(false);
      await signIn("flaky@example.com", NEW_PASSWORD);
      expect(events.passwordReset).toHaveLength(1);
    });

    test("a notice that never settles does not hold the reset response", async () => {
      await signUpAndVerify("slow-reset@example.com", "Slow");
      await auth.api.requestPasswordReset({
        body: { email: "slow-reset@example.com", redirectTo: `${APP_ORIGIN}/reset-password` },
      });
      const token = emailSender.lastResetPasswordTokenFor("slow-reset@example.com");
      emailSender.sendPasswordChangedNotice = () => new Promise<void>(() => {});

      try {
        const result = await auth.api.resetPassword({ body: { token, newPassword: NEW_PASSWORD } });
        expect(result).toEqual({ status: true });
      } finally {
        delete (emailSender as { sendPasswordChangedNotice?: unknown }).sendPasswordChangedNotice;
      }
    });
  });

  describe("R3.4 set a password for a Google-only user through reset", () => {
    test("completing a reset creates the credential account", async () => {
      await handle.db.insert(schema.user).values({
        id: "google-user",
        name: "Google Only",
        email: "google-only@example.com",
        emailVerified: true,
      });
      await handle.db.insert(schema.account).values({
        id: "google-account",
        accountId: "google-subject",
        providerId: "google",
        userId: "google-user",
      });
      await auth.api.requestPasswordReset({
        body: { email: "google-only@example.com", redirectTo: `${APP_ORIGIN}/reset-password` },
      });
      const token = emailSender.lastResetPasswordTokenFor("google-only@example.com");

      await auth.api.resetPassword({ body: { token, newPassword: NEW_PASSWORD } });

      const accounts = await handle.db
        .select({ providerId: schema.account.providerId })
        .from(schema.account)
        .where(eq(schema.account.userId, "google-user"));
      expect(accounts.map((row) => row.providerId).toSorted()).toEqual(["credential", "google"]);
      await signIn("google-only@example.com", NEW_PASSWORD);
    });
  });

  describe("R3.1 / R3.5 change password", () => {
    test("revokes the other sessions (even when the client does not ask) and sends the notice", async () => {
      const { headers, userId } = await signUpAndVerify("change@example.com", "Change");
      const otherDevice = await signIn("change@example.com");

      const response = await auth.api.changePassword({
        body: { currentPassword: TEST_PASSWORD, newPassword: NEW_PASSWORD },
        headers,
        asResponse: true,
      });
      expect(response.status).toBe(200);

      expect(await hasSession(otherDevice)).toBe(false);
      // The current device keeps a working session: the endpoint issues a fresh cookie.
      const refreshed = cookieHeaderFromSetCookie(response.headers.get("set-cookie"));
      expect(await hasSession(refreshed)).toBe(true);
      await signIn("change@example.com", NEW_PASSWORD);
      expect(emailSender.passwordChangedNotices).toHaveLength(1);
      expect(emailSender.passwordChangedNotices[0]?.to).toBe("change@example.com");
      expect(events.passwordChanged).toEqual([{ userId, email: "change@example.com" }]);
    });

    test("a notice that never settles does not hold the response, and the change still applies", async () => {
      const { headers } = await signUpAndVerify("slow-change@example.com", "Slow");
      const otherDevice = await signIn("slow-change@example.com");
      emailSender.sendPasswordChangedNotice = () => new Promise<void>(() => {});

      try {
        const response = await auth.api.changePassword({
          body: { currentPassword: TEST_PASSWORD, newPassword: NEW_PASSWORD },
          headers,
          asResponse: true,
        });
        expect(response.status).toBe(200);
      } finally {
        delete (emailSender as { sendPasswordChangedNotice?: unknown }).sendPasswordChangedNotice;
      }

      expect(await hasSession(otherDevice)).toBe(false);
      await signIn("slow-change@example.com", NEW_PASSWORD);
    });

    test("a wrong current password changes nothing and sends no notice", async () => {
      const { headers } = await signUpAndVerify("wrong@example.com", "Wrong");
      const otherDevice = await signIn("wrong@example.com");

      const failure = await rejection(
        auth.api.changePassword({
          body: { currentPassword: "not the password", newPassword: NEW_PASSWORD },
          headers,
        }),
      );

      expect(failure.statusCode).toBe(400);
      expect(await hasSession(otherDevice)).toBe(true);
      expect(emailSender.passwordChangedNotices).toHaveLength(0);
      expect(events.passwordChanged).toHaveLength(0);
    });
  });

  describe("R2 change email", () => {
    test("approval goes to the current address first; the email changes only after the new address is verified", async () => {
      const { headers, userId } = await signUpAndVerify("old@example.com", "Mover");
      emailSender.reset();

      await auth.api.changeEmail({
        body: { newEmail: "new@example.com", callbackURL: `${APP_ORIGIN}/account/security` },
        headers,
      });

      // R2.1: only the current address is contacted and nothing changes yet.
      expect(emailSender.changeEmailApprovals).toHaveLength(1);
      expect(emailSender.changeEmailApprovals[0]).toMatchObject({
        to: "old@example.com",
        newEmail: "new@example.com",
      });
      expect(emailSender.verifications).toHaveLength(0);
      expect(await userEmail(userId)).toBe("old@example.com");

      // R2.2: opening the approval link sends the verification to the NEW address only.
      await auth.api.verifyEmail({
        query: { token: emailSender.lastChangeEmailApprovalTokenFor("old@example.com") },
        headers,
      });
      expect(emailSender.verifications).toHaveLength(1);
      expect(emailSender.verifications[0]?.to).toBe("new@example.com");
      expect(await userEmail(userId)).toBe("old@example.com");

      await auth.api.verifyEmail({
        query: { token: emailSender.lastVerificationTokenFor("new@example.com") },
        headers,
      });
      expect(await userEmail(userId)).toBe("new@example.com");
      const [row] = await handle.db
        .select({ emailVerified: schema.user.emailVerified })
        .from(schema.user)
        .where(eq(schema.user.id, userId));
      expect(row?.emailVerified).toBe(true);
    });

    test("R2.3: a taken address answers like a free one and sends nothing", async () => {
      const { headers, userId } = await signUpAndVerify("mover@example.com", "Mover");
      await signUpAndVerify("taken@example.com", "Taken");
      emailSender.reset();

      const taken = await auth.api.changeEmail({
        body: { newEmail: "taken@example.com" },
        headers,
      });
      const free = await auth.api.changeEmail({ body: { newEmail: "free@example.com" }, headers });

      expect(taken).toEqual(free);
      expect(emailSender.changeEmailApprovals.map((entry) => entry.newEmail)).toEqual([
        "free@example.com",
      ]);
      expect(await userEmail(userId)).toBe("mover@example.com");
    });
  });

  describe("R4 sessions", () => {
    test("lists sessions, revokes one, refuses the current one, revokes all others", async () => {
      const { headers } = await signUpAndVerify("sessions@example.com", "Sessions");
      const second = await signIn("sessions@example.com");
      const third = await signIn("sessions@example.com");

      const sessions = await auth.api.listSessions({ headers });
      expect(sessions).toHaveLength(3);
      const current = await auth.api.getSession({ headers });
      const secondToken = (await auth.api.getSession({ headers: second }))?.session.token;
      expect(current?.session.token).toBeTruthy();
      expect(secondToken).toBeTruthy();

      // R4.2: any session but the current one.
      const refusal = await rejection(
        auth.api.revokeSession({ body: { token: current?.session.token ?? "" }, headers }),
      );
      expect(refusal.statusCode).toBe(400);
      expect(refusal.body?.code).toBe("CANNOT_REVOKE_CURRENT_SESSION");
      expect(await hasSession(headers)).toBe(true);

      await auth.api.revokeSession({ body: { token: secondToken ?? "" }, headers });
      expect(await hasSession(second)).toBe(false);
      expect(await hasSession(third)).toBe(true);

      // R4.3: everything except the current session.
      await auth.api.revokeOtherSessions({ headers });
      expect(await hasSession(third)).toBe(false);
      expect(await hasSession(headers)).toBe(true);
      expect(await auth.api.listSessions({ headers })).toHaveLength(1);
    });

    test("a session cannot revoke another user's session", async () => {
      const { headers } = await signUpAndVerify("a@example.com", "A");
      await signUpAndVerify("b@example.com", "B");
      const otherToken = (await auth.api.getSession({ headers: await signIn("b@example.com") }))
        ?.session.token;

      await auth.api.revokeSession({ body: { token: otherToken ?? "" }, headers });

      expect(await hasSession(await signIn("b@example.com"))).toBe(true);
      const [stillThere] = await handle.db
        .select({ token: schema.session.token })
        .from(schema.session)
        .where(eq(schema.session.token, otherToken ?? ""));
      expect(stillThere?.token).toBe(otherToken);
    });
  });

  describe("R6 delete account", () => {
    async function createOrg(headers: Headers, name: string, slug: string) {
      return auth.api.createOrganization({ body: { name, slug }, headers });
    }

    test("R6.1: the last owner of an organization is refused, and the error lists those organizations", async () => {
      const { headers } = await signUpAndVerify("owner@example.com", "Owner");
      const solo = await createOrg(headers, "Solo Org", "solo-org");
      const shared = await createOrg(headers, "Shared Org", "shared-org");
      const { userId: coOwnerId } = await signUpAndVerify("co-owner@example.com", "Co Owner");
      await auth.api.addMember({
        body: { userId: coOwnerId, role: "owner", organizationId: shared.id },
      });
      emailSender.reset();

      const failure = await rejection(auth.api.deleteUser({ body: {}, headers }));

      expect(failure.statusCode).toBe(409);
      expect(failure.body?.code).toBe("USER_IS_LAST_OWNER");
      expect(failure.body).toMatchObject({
        organizations: [{ id: solo.id, name: "Solo Org" }],
      });
      expect(emailSender.deleteAccountConfirmations).toHaveLength(0);
      expect(events.userDeleting).toHaveLength(0);
    });

    test("R6.1: the organization list reaches the HTTP response body", async () => {
      const { headers } = await signUpAndVerify("http-owner@example.com", "Http Owner");
      const solo = await createOrg(headers, "Http Org", "http-org");

      const response = await auth.handler(
        new Request("http://localhost:3000/api/auth/delete-user", {
          method: "POST",
          headers: {
            cookie: headers.get("cookie") ?? "",
            origin: APP_ORIGIN,
            "content-type": "application/json",
          },
          body: JSON.stringify({}),
        }),
      );

      expect(response.status).toBe(409);
      expect(await response.json()).toMatchObject({
        code: "USER_IS_LAST_OWNER",
        organizations: [{ id: solo.id, name: "Http Org" }],
      });
    });

    test("R6.2 / R6.3: an eligible request emails a link; opening it hard-deletes with cascades", async () => {
      const { headers, userId } = await signUpAndVerify("leaver@example.com", "Leaver");
      const org = await createOrg(headers, "Handed Over", "handed-over");
      const { userId: successorId } = await signUpAndVerify("successor@example.com", "Successor");
      await auth.api.addMember({
        body: { userId: successorId, role: "owner", organizationId: org.id },
      });
      const otherDevice = await signIn("leaver@example.com");
      emailSender.reset();

      await auth.api.deleteUser({ body: { callbackURL: `${APP_ORIGIN}/sign-in` }, headers });

      // Nothing is deleted before the link is opened.
      expect(emailSender.deleteAccountConfirmations).toHaveLength(1);
      expect(emailSender.deleteAccountConfirmations[0]?.to).toBe("leaver@example.com");
      expect(await userEmail(userId)).toBe("leaver@example.com");
      expect(events.userDeleting).toHaveLength(0);

      await auth.api.deleteUserCallback({
        query: { token: emailSender.lastDeleteAccountTokenFor("leaver@example.com") },
        headers,
      });

      expect(await userEmail(userId)).toBeUndefined();
      expect(await hasSession(otherDevice)).toBe(false);
      const [sessions, accounts, memberships, remainingMembers] = await Promise.all([
        handle.db.select().from(schema.session).where(eq(schema.session.userId, userId)),
        handle.db.select().from(schema.account).where(eq(schema.account.userId, userId)),
        handle.db.select().from(schema.member).where(eq(schema.member.userId, userId)),
        handle.db.select().from(schema.member).where(eq(schema.member.organizationId, org.id)),
      ]);
      expect([sessions, accounts, memberships]).toEqual([[], [], []]);
      expect(remainingMembers.map((row) => row.userId)).toEqual([successorId]);
      expect(events.userDeleting).toEqual([
        { userId, email: "leaver@example.com", name: "Leaver" },
      ]);
    });

    test("R6.1: ownership gained after the request still blocks deletion when the link is opened", async () => {
      const { headers, userId } = await signUpAndVerify("late@example.com", "Late");
      await auth.api.deleteUser({ body: {}, headers });
      const token = emailSender.lastDeleteAccountTokenFor("late@example.com");
      await createOrg(headers, "Late Org", "late-org");

      const failure = await rejection(auth.api.deleteUserCallback({ query: { token }, headers }));

      expect(failure.body?.code).toBe("USER_IS_LAST_OWNER");
      expect(await userEmail(userId)).toBe("late@example.com");
    });

    test("R6.4 seam: a failing pre-delete callback aborts the deletion", async () => {
      const { headers, userId } = await signUpAndVerify("abort@example.com", "Abort");
      await auth.api.deleteUser({ body: {}, headers });
      const token = emailSender.lastDeleteAccountTokenFor("abort@example.com");
      events.failUserDeleting = true;

      await expect(auth.api.deleteUserCallback({ query: { token }, headers })).rejects.toThrow();

      expect(await userEmail(userId)).toBe("abort@example.com");
    });
  });
});
