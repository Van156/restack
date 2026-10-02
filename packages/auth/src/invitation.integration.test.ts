import { createTestDatabase, requireTestDatabaseOrSkip } from "@base-template/db/testing";
import type { TestDatabaseHandle } from "@base-template/db/testing";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { testUtils } from "better-auth/plugins";
import type { TestHelpers } from "better-auth/plugins";

import type { AuthConfig } from "./index";
import { createAuth } from "./index";
import {
  RecordingAuditLogger,
  RecordingEmailSender,
  resolveTestDatabaseUrl,
  signUpAndVerify as sharedSignUpAndVerify,
  TEST_PASSWORD,
  truncateAllTables,
} from "./testing";

/**
 * Integration tests for the invitation flow (docs/specs/auth-multitenant-rbac.md
 * R2). Companion to `auth.integration.test.ts` (R0, R1, R2.1); split out
 * because R2 alone covers eight scenarios across both better-auth's native
 * invitation routes and the custom `/invitation/sign-up` endpoint
 * (`./plugins/invitation-sign-up.ts`).
 *
 * Several scenarios below (R2.1, R2.3, R2.5, R2.6-native, R2.7, R2.8) are
 * satisfied by better-auth 1.7.5's organization plugin out of the box; the
 * tests for them are regression tests, not RED/GREEN — they passed the first
 * time they were run, before any T4 code was written. R2.2 and R2.4 (and the
 * custom-endpoint half of R2.6) required new code in `./index.ts` and
 * `./plugins/invitation-sign-up.ts` and were genuinely RED first.
 *
 * Skips cleanly (does not fail) when no test database is reachable.
 */
const TEST_DATABASE_URL = resolveTestDatabaseUrl();

const reachable = await requireTestDatabaseOrSkip(TEST_DATABASE_URL, "invitations (R2)");

describe.skipIf(!reachable)("invitations (R2)", () => {
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

  /** Signs up an owner, creates an organization, and returns both. */
  async function ownerWithOrg(emailPrefix: string) {
    const { headers, userId } = await signUpAndVerify(`${emailPrefix}-owner@example.com`, "Owner");
    const org = await auth.api.createOrganization({
      body: { name: `${emailPrefix} Org`, slug: `${emailPrefix}-org` },
      headers,
    });
    if (!org) {
      throw new Error("createOrganization returned null");
    }
    return { ownerHeaders: headers, ownerId: userId, organizationId: org.id };
  }

  /**
   * Reads an invitation's `status` directly through better-auth's generic
   * adapter. Native `getInvitation` only returns invitations while they are
   * still `pending` (it 404s otherwise, by design), so it cannot be used to
   * observe a non-pending outcome from the caller's side.
   */
  async function invitationStatus(invitationId: string): Promise<string | undefined> {
    const context = await auth.$context;
    const invitation = await context.adapter.findOne<{ status: string }>({
      model: "invitation",
      where: [{ field: "id", value: invitationId }],
    });
    return invitation?.status;
  }

  /** Whether a user account exists for `email` (used to assert no account was created). */
  async function userExistsForEmail(email: string): Promise<boolean> {
    const context = await auth.$context;
    return Boolean(await context.internalAdapter.findUserByEmail(email));
  }

  describe("R2.2: cannot invite above own privileges (custom dynamic roles)", () => {
    test("rejects inviting a custom role whose permissions the inviter does not hold", async () => {
      const { ownerHeaders, organizationId } = await ownerWithOrg("r2-2-reject");

      // A member who is not owner (owner-only permission: organization:delete).
      const { userId: adminUserId, headers: adminHeaders } = await signUpAndVerify(
        "r2-2-admin@example.com",
        "Admin",
      );
      await testHelpers.addMember?.({ userId: adminUserId, organizationId, role: "admin" });

      const customRole = await auth.api.createOrgRole({
        body: {
          organizationId,
          role: "org-destroyer",
          permission: { organization: ["delete"] },
        },
        headers: ownerHeaders,
      });
      expect(customRole).toBeTruthy();

      await expect(
        auth.api.createInvitation({
          body: { email: "invitee-r2-2@example.com", role: "org-destroyer", organizationId },
          headers: adminHeaders,
        }),
      ).rejects.toThrow();

      // No invitation should have been persisted or emailed.
      expect(emailSender.invitations.some((i) => i.to === "invitee-r2-2@example.com")).toBe(false);
    });

    test("allows inviting a custom role whose permissions the inviter already holds", async () => {
      const { ownerHeaders, organizationId } = await ownerWithOrg("r2-2-allow");

      const { userId: adminUserId, headers: adminHeaders } = await signUpAndVerify(
        "r2-2-allow-admin@example.com",
        "Admin",
      );
      await testHelpers.addMember?.({ userId: adminUserId, organizationId, role: "admin" });

      // project:read is granted to both admin and member (org.ts) -- a
      // permission the admin inviter already holds.
      await auth.api.createOrgRole({
        body: { organizationId, role: "read-only", permission: { project: ["read"] } },
        headers: ownerHeaders,
      });

      const invitation = await auth.api.createInvitation({
        body: { email: "invitee-r2-2-allow@example.com", role: "read-only", organizationId },
        headers: adminHeaders,
      });

      // `role` is typed against the built-in role union; a custom dynamic
      // role name is still a plain string at runtime.
      expect(invitation?.role as string).toBe("read-only");
      expect(emailSender.invitations.some((i) => i.to === "invitee-r2-2-allow@example.com")).toBe(
        true,
      );
    });
  });

  describe("R2.3: accept — existing verified user", () => {
    test("becomes a member with the invited role; invitation is accepted", async () => {
      const { ownerHeaders, organizationId } = await ownerWithOrg("r2-3");
      const invitation = await auth.api.createInvitation({
        body: { email: "r2-3-invitee@example.com", role: "member", organizationId },
        headers: ownerHeaders,
      });

      const { headers: inviteeHeaders } = await signUpAndVerify(
        "r2-3-invitee@example.com",
        "Invitee",
      );

      const result = await auth.api.acceptInvitation({
        body: { invitationId: invitation!.id },
        headers: inviteeHeaders,
      });

      expect(result?.invitation?.status).toBe("accepted");
      expect(result?.member?.role).toBe("member");
    });
  });

  describe("R2.4: accept — new user via custom sign-up endpoint", () => {
    test("attacker path: a correct invitation ID with no/wrong token is rejected; no account is created, invitation stays pending", async () => {
      const { ownerHeaders, organizationId } = await ownerWithOrg("r2-4-token-attack");
      const email = "r2-4-token-attack-invitee@example.com";
      const invitation = await auth.api.createInvitation({
        body: { email, role: "member", organizationId },
        headers: ownerHeaders,
      });

      await expect(
        auth.api.signUpViaInvitation({
          body: {
            invitationId: invitation!.id,
            token: "not-the-real-token",
            name: "Attacker",
            password: TEST_PASSWORD,
          },
        }),
      ).rejects.toThrow();

      expect(await invitationStatus(invitation!.id)).toBe("pending");
      expect(await userExistsForEmail(email)).toBe(false);
    });

    test("creates a verified account, starts a session, and accepts the invitation", async () => {
      const { ownerHeaders, organizationId } = await ownerWithOrg("r2-4");
      const invitation = await auth.api.createInvitation({
        body: { email: "r2-4-invitee@example.com", role: "member", organizationId },
        headers: ownerHeaders,
      });
      // The invitation-sign-up token is only ever emailed, never returned here.
      expect((invitation as unknown as { token?: unknown }).token).toBeUndefined();
      const token = emailSender.lastInvitationTokenFor("r2-4-invitee@example.com");
      emailSender.reset();

      const response = await auth.api.signUpViaInvitation({
        body: { invitationId: invitation!.id, token, name: "New Invitee", password: TEST_PASSWORD },
        asResponse: true,
      });

      expect(response.status).toBe(200);
      const setCookie = response.headers.get("set-cookie");
      expect(setCookie).toBeTruthy();

      // No verification email: the invitation link already proved inbox ownership.
      expect(emailSender.verifications).toHaveLength(0);

      const cookiePair = setCookie?.split(";")[0] ?? "";
      const session = await auth.api.getSession({ headers: new Headers({ cookie: cookiePair }) });
      expect(session?.user.email).toBe("r2-4-invitee@example.com");
      expect(session?.user.emailVerified).toBe(true);
      expect(session?.session.activeOrganizationId).toBe(organizationId);

      const membership = await auth.api.getActiveMember({
        headers: new Headers({ cookie: cookiePair }),
      });
      expect(membership?.role).toBe("member");

      expect(await invitationStatus(invitation!.id)).toBe("accepted");
    });

    test("rejects when the invited email already has an account, and leaves the invitation pending", async () => {
      const { ownerHeaders, organizationId } = await ownerWithOrg("r2-4-dup");
      await signUpAndVerify("r2-4-dup-invitee@example.com", "Existing User");
      const invitation = await auth.api.createInvitation({
        body: { email: "r2-4-dup-invitee@example.com", role: "member", organizationId },
        headers: ownerHeaders,
      });
      const token = emailSender.lastInvitationTokenFor("r2-4-dup-invitee@example.com");

      await expect(
        auth.api.signUpViaInvitation({
          body: {
            invitationId: invitation!.id,
            token,
            name: "Impersonator",
            password: TEST_PASSWORD,
          },
        }),
      ).rejects.toThrow();

      // The invitation was never claimed: it is still pending, redeemable
      // once the caller signs in as the existing account instead.
      expect(await invitationStatus(invitation!.id)).toBe("pending");
    });

    test("rejects a password shorter than the configured minimum", async () => {
      const { ownerHeaders, organizationId } = await ownerWithOrg("r2-4-short-pw");
      const invitation = await auth.api.createInvitation({
        body: { email: "r2-4-short-pw-invitee@example.com", role: "member", organizationId },
        headers: ownerHeaders,
      });
      const token = emailSender.lastInvitationTokenFor("r2-4-short-pw-invitee@example.com");

      await expect(
        auth.api.signUpViaInvitation({
          body: { invitationId: invitation!.id, token, name: "Invitee", password: "a" },
        }),
      ).rejects.toThrow();
    });
  });

  describe("T5a: hashing order and compensation guard on sign-up-via-invitation failure", () => {
    test("hashes the password before claiming the invitation, so a hashing failure leaves it pending and untouched", async () => {
      const { ownerHeaders, organizationId } = await ownerWithOrg("t5a-hash-order");
      const email = "t5a-hash-order-invitee@example.com";
      const invitation = await auth.api.createInvitation({
        body: { email, role: "member", organizationId },
        headers: ownerHeaders,
      });
      const token = emailSender.lastInvitationTokenFor(email);

      const context = await auth.$context;
      const originalHash = context.password.hash.bind(context.password);
      context.password.hash = (async () => {
        throw new Error("simulated hashing failure");
      }) as typeof context.password.hash;

      try {
        await expect(
          auth.api.signUpViaInvitation({
            body: { invitationId: invitation!.id, token, name: "Doomed", password: TEST_PASSWORD },
          }),
        ).rejects.toThrow("simulated hashing failure");
      } finally {
        context.password.hash = originalHash;
      }

      // If hashing ran AFTER claiming (the pre-fix order), the invitation
      // would already be stuck "accepted" with no member/user ever created.
      expect(await invitationStatus(invitation!.id)).toBe("pending");
      expect(await userExistsForEmail(email)).toBe(false);
    });

    test("rethrows the original failure even when reverting the claim also fails, and logs the compensation failure", async () => {
      const { ownerHeaders, organizationId } = await ownerWithOrg("t5a-compensation-guard");
      const email = "t5a-compensation-guard-invitee@example.com";
      const invitation = await auth.api.createInvitation({
        body: { email, role: "member", organizationId },
        headers: ownerHeaders,
      });
      const token = emailSender.lastInvitationTokenFor(email);

      const context = await auth.$context;
      type AdapterCreateArgs = Parameters<typeof context.adapter.create>[0];
      type AdapterUpdateArgs = Parameters<typeof context.adapter.update>[0];
      const originalCreate = context.adapter.create.bind(context.adapter);
      const originalUpdate = context.adapter.update.bind(context.adapter);
      const originalConsoleError = console.error;
      const loggedMessages: unknown[][] = [];
      console.error = (...args: unknown[]) => {
        loggedMessages.push(args);
      };

      // Force the member-creation step to fail (any post-claim failure would
      // do), and force the compensation's revert-to-pending update to fail
      // too, so the ORIGINAL error must still be the one that surfaces.
      context.adapter.create = (async (params: AdapterCreateArgs) => {
        if (params.model === "member") {
          throw new Error("simulated member creation failure");
        }
        return originalCreate(params);
      }) as typeof context.adapter.create;
      context.adapter.update = (async (params: AdapterUpdateArgs) => {
        const revertsClaim = params.where?.some(
          (condition: { field: string; value: unknown }) =>
            condition.field === "status" && condition.value === "accepted",
        );
        if (params.model === "invitation" && revertsClaim) {
          throw new Error("simulated compensation failure");
        }
        return originalUpdate(params);
      }) as typeof context.adapter.update;

      try {
        await expect(
          auth.api.signUpViaInvitation({
            body: { invitationId: invitation!.id, token, name: "Doomed", password: TEST_PASSWORD },
          }),
        ).rejects.toThrow("simulated member creation failure");
      } finally {
        context.adapter.create = originalCreate;
        context.adapter.update = originalUpdate;
        console.error = originalConsoleError;
      }

      expect(
        loggedMessages.some((entry) => String(entry[0]).toLowerCase().includes("revert")),
      ).toBe(true);
    });
  });

  describe("R2.5: email mismatch", () => {
    test("acceptance fails when the signed-in user's email differs from the invitation", async () => {
      const { ownerHeaders, organizationId } = await ownerWithOrg("r2-5");
      const invitation = await auth.api.createInvitation({
        body: { email: "r2-5-invitee@example.com", role: "member", organizationId },
        headers: ownerHeaders,
      });

      const { headers: wrongUserHeaders } = await signUpAndVerify(
        "r2-5-someone-else@example.com",
        "Wrong",
      );

      await expect(
        auth.api.acceptInvitation({
          body: { invitationId: invitation!.id },
          headers: wrongUserHeaders,
        }),
      ).rejects.toThrow();
    });
  });

  describe("R2.6: expired / cancelled / already accepted", () => {
    test("native accept: a cancelled invitation cannot be accepted", async () => {
      const { ownerHeaders, organizationId } = await ownerWithOrg("r2-6-native-cancel");
      const invitation = await auth.api.createInvitation({
        body: { email: "r2-6-cancel-invitee@example.com", role: "member", organizationId },
        headers: ownerHeaders,
      });
      await auth.api.cancelInvitation({
        body: { invitationId: invitation!.id },
        headers: ownerHeaders,
      });

      const { headers: inviteeHeaders } = await signUpAndVerify(
        "r2-6-cancel-invitee@example.com",
        "Invitee",
      );
      await expect(
        auth.api.acceptInvitation({
          body: { invitationId: invitation!.id },
          headers: inviteeHeaders,
        }),
      ).rejects.toThrow();
    });

    test("native accept: an already-accepted invitation cannot be accepted twice", async () => {
      const { ownerHeaders, organizationId } = await ownerWithOrg("r2-6-native-reused");
      const invitation = await auth.api.createInvitation({
        body: { email: "r2-6-reused-invitee@example.com", role: "member", organizationId },
        headers: ownerHeaders,
      });
      const { headers: inviteeHeaders } = await signUpAndVerify(
        "r2-6-reused-invitee@example.com",
        "Invitee",
      );
      await auth.api.acceptInvitation({
        body: { invitationId: invitation!.id },
        headers: inviteeHeaders,
      });

      await expect(
        auth.api.acceptInvitation({
          body: { invitationId: invitation!.id },
          headers: inviteeHeaders,
        }),
      ).rejects.toThrow();
    });

    test("custom sign-up endpoint: a cancelled invitation is rejected, no account is created", async () => {
      const { ownerHeaders, organizationId } = await ownerWithOrg("r2-6-custom-cancel");
      const invitation = await auth.api.createInvitation({
        body: { email: "r2-6-custom-cancel-invitee@example.com", role: "member", organizationId },
        headers: ownerHeaders,
      });
      const token = emailSender.lastInvitationTokenFor("r2-6-custom-cancel-invitee@example.com");
      await auth.api.cancelInvitation({
        body: { invitationId: invitation!.id },
        headers: ownerHeaders,
      });

      await expect(
        auth.api.signUpViaInvitation({
          body: { invitationId: invitation!.id, token, name: "Invitee", password: TEST_PASSWORD },
        }),
      ).rejects.toThrow();

      // Still canceled, not flipped to accepted (no account was created either).
      expect(await invitationStatus(invitation!.id)).toBe("canceled");
    });

    test("custom sign-up endpoint: an expired invitation is rejected", async () => {
      const { ownerHeaders, organizationId } = await ownerWithOrg("r2-6-custom-expired");
      const invitation = await auth.api.createInvitation({
        body: { email: "r2-6-custom-expired-invitee@example.com", role: "member", organizationId },
        headers: ownerHeaders,
      });
      const token = emailSender.lastInvitationTokenFor("r2-6-custom-expired-invitee@example.com");

      // Force the invitation into the past directly (no clock mocking helper
      // is available); this is the same "expired" state better-auth's own
      // accept route checks via `invitation.expiresAt < new Date()`.
      const context = await auth.$context;
      await context.adapter.update({
        model: "invitation",
        where: [{ field: "id", value: invitation!.id }],
        update: { expiresAt: new Date(Date.now() - 1000) },
      });

      await expect(
        auth.api.signUpViaInvitation({
          body: { invitationId: invitation!.id, token, name: "Invitee", password: TEST_PASSWORD },
        }),
      ).rejects.toThrow();
    });

    test("custom sign-up endpoint: an already-accepted invitation cannot be redeemed twice", async () => {
      const { ownerHeaders, organizationId } = await ownerWithOrg("r2-6-custom-reused");
      const invitation = await auth.api.createInvitation({
        body: { email: "r2-6-custom-reused-invitee@example.com", role: "member", organizationId },
        headers: ownerHeaders,
      });
      const token = emailSender.lastInvitationTokenFor("r2-6-custom-reused-invitee@example.com");

      await auth.api.signUpViaInvitation({
        body: { invitationId: invitation!.id, token, name: "Invitee", password: TEST_PASSWORD },
      });

      await expect(
        auth.api.signUpViaInvitation({
          body: {
            invitationId: invitation!.id,
            token,
            name: "Second Try",
            password: TEST_PASSWORD,
          },
        }),
      ).rejects.toThrow();
    });
  });

  describe("R2.7: cancel / resend", () => {
    test("a member with invitation:cancel can cancel a pending invitation", async () => {
      const { ownerHeaders, organizationId } = await ownerWithOrg("r2-7-cancel");
      const invitation = await auth.api.createInvitation({
        body: { email: "r2-7-cancel-invitee@example.com", role: "member", organizationId },
        headers: ownerHeaders,
      });

      const cancelled = await auth.api.cancelInvitation({
        body: { invitationId: invitation!.id },
        headers: ownerHeaders,
      });

      expect(cancelled?.status).toBe("canceled");
    });

    test("a member without invitation:cancel cannot cancel an invitation", async () => {
      const { ownerHeaders, organizationId } = await ownerWithOrg("r2-7-forbidden");
      const invitation = await auth.api.createInvitation({
        body: { email: "r2-7-forbidden-invitee@example.com", role: "member", organizationId },
        headers: ownerHeaders,
      });

      const { userId: plainMemberId, headers: plainMemberHeaders } = await signUpAndVerify(
        "r2-7-plain-member@example.com",
        "Plain Member",
      );
      await testHelpers.addMember?.({ userId: plainMemberId, organizationId, role: "member" });

      await expect(
        auth.api.cancelInvitation({
          body: { invitationId: invitation!.id },
          headers: plainMemberHeaders,
        }),
      ).rejects.toThrow();
    });

    test("resending an invitation (resend: true) gives it a new expiry and re-sends the email", async () => {
      const { ownerHeaders, organizationId } = await ownerWithOrg("r2-7-resend");
      const invitation = await auth.api.createInvitation({
        body: { email: "r2-7-resend-invitee@example.com", role: "member", organizationId },
        headers: ownerHeaders,
      });
      const originalExpiresAt = invitation!.expiresAt;
      emailSender.reset();

      const resent = await auth.api.createInvitation({
        body: {
          email: "r2-7-resend-invitee@example.com",
          role: "member",
          organizationId,
          resend: true,
        },
        headers: ownerHeaders,
      });

      expect(resent?.id).toBe(invitation!.id);
      expect(new Date(resent!.expiresAt).getTime()).toBeGreaterThan(
        new Date(originalExpiresAt).getTime(),
      );
      expect(emailSender.invitations.some((i) => i.to === "r2-7-resend-invitee@example.com")).toBe(
        true,
      );
    });

    test("resending an invitation invalidates the previous accept token; only the new one works", async () => {
      const { ownerHeaders, organizationId } = await ownerWithOrg("r2-7-resend-token");
      const email = "r2-7-resend-token-invitee@example.com";
      const invitation = await auth.api.createInvitation({
        body: { email, role: "member", organizationId },
        headers: ownerHeaders,
      });
      const oldToken = emailSender.lastInvitationTokenFor(email);

      await auth.api.createInvitation({
        body: { email, role: "member", organizationId, resend: true },
        headers: ownerHeaders,
      });
      const newToken = emailSender.lastInvitationTokenFor(email);
      expect(newToken).not.toBe(oldToken);

      await expect(
        auth.api.signUpViaInvitation({
          body: {
            invitationId: invitation!.id,
            token: oldToken,
            name: "Old Link",
            password: TEST_PASSWORD,
          },
        }),
      ).rejects.toThrow();
      expect(await invitationStatus(invitation!.id)).toBe("pending");

      const response = await auth.api.signUpViaInvitation({
        body: {
          invitationId: invitation!.id,
          token: newToken,
          name: "New Link",
          password: TEST_PASSWORD,
        },
        asResponse: true,
      });
      expect(response.status).toBe(200);
    });

    test("T5e: a failed resend email keeps the old invitation link working", async () => {
      const { ownerHeaders, organizationId } = await ownerWithOrg("t5e-resend-failure");
      const email = "t5e-resend-failure-invitee@example.com";
      const invitation = await auth.api.createInvitation({
        body: { email, role: "member", organizationId },
        headers: ownerHeaders,
      });
      const oldToken = emailSender.lastInvitationTokenFor(email);

      emailSender.failNextInvitation();
      // better-auth runs `sendInvitationEmail` via `runInBackgroundOrAwait`,
      // which swallows/logs a rejection rather than failing the request
      // (verified against better-auth 1.7.5's own background-task runner);
      // the resend call itself still resolves.
      await auth.api.createInvitation({
        body: { email, role: "member", organizationId, resend: true },
        headers: ownerHeaders,
      });

      // The old, previously emailed link must still redeem the invitation:
      // the send failed, so the previous token row must never have been
      // removed (T5e).
      const response = await auth.api.signUpViaInvitation({
        body: {
          invitationId: invitation!.id,
          token: oldToken,
          name: "Old Link",
          password: TEST_PASSWORD,
        },
        asResponse: true,
      });
      expect(response.status).toBe(200);
    });
  });

  describe("R2.8: duplicate invite/member", () => {
    test("inviting an email that is already a member fails", async () => {
      const { ownerHeaders, organizationId } = await ownerWithOrg("r2-8-member");
      const { userId } = await signUpAndVerify("r2-8-member@example.com", "Member");
      await testHelpers.addMember?.({ userId, organizationId, role: "member" });

      await expect(
        auth.api.createInvitation({
          body: { email: "r2-8-member@example.com", role: "member", organizationId },
          headers: ownerHeaders,
        }),
      ).rejects.toThrow();
    });

    test("inviting an email with an existing pending invitation fails without resend", async () => {
      const { ownerHeaders, organizationId } = await ownerWithOrg("r2-8-pending");
      await auth.api.createInvitation({
        body: { email: "r2-8-pending-invitee@example.com", role: "member", organizationId },
        headers: ownerHeaders,
      });

      await expect(
        auth.api.createInvitation({
          body: { email: "r2-8-pending-invitee@example.com", role: "member", organizationId },
          headers: ownerHeaders,
        }),
      ).rejects.toThrow();
    });
  });
});
