import * as schema from "@base-template/db/schema";
import { createTestDatabase, requireTestDatabaseOrSkip } from "@base-template/db/testing";
import type { TestDatabaseHandle } from "@base-template/db/testing";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { testUtils } from "better-auth/plugins";
import type { TestHelpers } from "better-auth/plugins";
import { eq } from "drizzle-orm";

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
 * Integration tests for `createAuth` wiring against a real Postgres
 * database (docs/specs/auth-multitenant-rbac.md R0, R1.1a, R1.1b, R2.1).
 *
 * Skips cleanly (does not fail) when no test database is reachable; in a
 * normal `pnpm db:start` / CI setup, the suite actually executes.
 */
const TEST_DATABASE_URL = resolveTestDatabaseUrl();

const reachable = await requireTestDatabaseOrSkip(
  TEST_DATABASE_URL,
  "createAuth integration (R0, R1.1a/b, R2.1)",
);

describe.skipIf(!reachable)("createAuth integration (R0, R1.1a/b, R2.1)", () => {
  let handle: TestDatabaseHandle;
  let emailSender: RecordingEmailSender;
  let auditLogger: RecordingAuditLogger;
  let authConfig: AuthConfig;
  let auth: ReturnType<typeof createAuth>;
  let testHelpers: TestHelpers;
  let initialMaxOrgs: number;

  beforeAll(async () => {
    handle = createTestDatabase(TEST_DATABASE_URL);
    emailSender = new RecordingEmailSender();
    auditLogger = new RecordingAuditLogger();
    authConfig = {
      BETTER_AUTH_URL: "http://localhost:3000",
      BETTER_AUTH_SECRET: "a-32-character-long-test-secret",
      CORS_ORIGIN: "http://localhost:3001",
      DEFAULT_MAX_ORGS_PER_USER: 3,
    };
    initialMaxOrgs = authConfig.DEFAULT_MAX_ORGS_PER_USER;
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
    authConfig.DEFAULT_MAX_ORGS_PER_USER = initialMaxOrgs;
    await truncateAllTables(handle.db);
  });

  // Tests mutate the shared config object; restore it so no test leaks its limit into the next.
  afterEach(() => {
    authConfig.DEFAULT_MAX_ORGS_PER_USER = initialMaxOrgs;
  });

  /** Signs a user up, verifies them via the captured email link, and returns authenticated request headers. */
  function signUpAndVerify(
    email: string,
    name: string,
  ): Promise<{ headers: Headers; userId: string }> {
    return sharedSignUpAndVerify(auth, emailSender, email, name);
  }

  test("R0.1: sign-up sends a verification email; sign-in before verification is refused", async () => {
    const email = "r0-1@example.com";

    const signUpResult = await auth.api.signUpEmail({
      body: { email, password: TEST_PASSWORD, name: "R0.1 User" },
    });

    expect(signUpResult.token).toBeNull();
    expect(emailSender.verifications).toHaveLength(1);
    expect(emailSender.verifications[0]?.to).toBe(email);
    expect(emailSender.verifications[0]?.url).toContain("token=");

    await expect(
      auth.api.signInEmail({ body: { email, password: TEST_PASSWORD } }),
    ).rejects.toThrow();
  });

  test("R0.2: verifying via the captured link marks emailVerified and auto signs the user in", async () => {
    const email = "r0-2@example.com";
    await auth.api.signUpEmail({ body: { email, password: TEST_PASSWORD, name: "R0.2 User" } });
    const token = emailSender.lastVerificationTokenFor(email);

    const verifyResponse = await auth.api.verifyEmail({ query: { token }, asResponse: true });
    expect(verifyResponse.status).toBe(200);
    const setCookie = verifyResponse.headers.get("set-cookie");
    expect(setCookie).toBeTruthy();

    const cookiePair = setCookie?.split(";")[0] ?? "";
    const session = await auth.api.getSession({ headers: new Headers({ cookie: cookiePair }) });
    expect(session?.user.emailVerified).toBe(true);
    expect(session?.session).toBeTruthy();
  });

  test("R1.1a: unverified user cannot create an organization; verified user can and becomes owner", async () => {
    const unverifiedEmail = "r1-1a-unverified@example.com";
    const unverifiedSignUp = await auth.api.signUpEmail({
      body: { email: unverifiedEmail, password: TEST_PASSWORD, name: "Unverified" },
    });
    // The normal sign-in/sign-up flow never grants an unverified user a
    // session (R0.1), so we forge one here to exercise the
    // allowUserToCreateOrganization guard directly (better-auth's own
    // test-utils plugin; see its `testUtils` doc comment).
    const { headers: unverifiedHeaders } = await testHelpers.login({
      userId: unverifiedSignUp.user.id,
    });

    await expect(
      auth.api.createOrganization({
        body: { name: "Should Fail Org", slug: "should-fail-org" },
        headers: unverifiedHeaders,
      }),
    ).rejects.toThrow();

    const { headers: verifiedHeaders } = await signUpAndVerify(
      "r1-1a-verified@example.com",
      "Verified",
    );

    const org = await auth.api.createOrganization({
      body: { name: "Acme Inc", slug: "acme-inc" },
      headers: verifiedHeaders,
    });

    expect(org?.id).toBeTruthy();
    expect(org?.members).toHaveLength(1);
    expect(org?.members[0]?.role).toBe("owner");
  });

  test("R1.1b: enforces DEFAULT_MAX_ORGS_PER_USER and a per-user override; invited membership doesn't consume the owner quota", async () => {
    authConfig.DEFAULT_MAX_ORGS_PER_USER = 1;

    const { headers, userId } = await signUpAndVerify("r1-1b@example.com", "Quota User");

    const firstOrg = await auth.api.createOrganization({
      body: { name: "Org One", slug: "org-one" },
      headers,
    });
    expect(firstOrg?.members[0]?.role).toBe("owner");

    await expect(
      auth.api.createOrganization({ body: { name: "Org Two", slug: "org-two" }, headers }),
    ).rejects.toThrow();

    // Being invited as a plain member of ANOTHER org (inserted directly via
    // the DB, as the task allows) must not consume the owner-org quota.
    const { headers: otherOwnerHeaders } = await signUpAndVerify(
      "r1-1b-other-owner@example.com",
      "Other Owner",
    );
    const otherOrg = await auth.api.createOrganization({
      body: { name: "Other Org", slug: "other-org" },
      headers: otherOwnerHeaders,
    });
    await testHelpers.addMember?.({ userId, organizationId: otherOrg!.id, role: "member" });

    await expect(
      auth.api.createOrganization({ body: { name: "Org Three", slug: "org-three" }, headers }),
    ).rejects.toThrow();

    // Per-user override (R6.6): raising maxOrganizations allows a second owned org.
    await handle.db
      .update(schema.user)
      .set({ maxOrganizations: 2 })
      .where(eq(schema.user.id, userId));

    const secondOwnedOrg = await auth.api.createOrganization({
      body: { name: "Org Four", slug: "org-four" },
      headers,
    });
    expect(secondOwnedOrg?.members[0]?.role).toBe("owner");
  });

  describe("R9.1: promoting a member to owner respects the target's owned-org limit", () => {
    /** An owner of `slug` org plus a target user who is a plain member of it, with its memberId. */
    async function orgWithMember(slug: string) {
      const { headers: ownerHeaders } = await signUpAndVerify(`${slug}-owner@example.com`, "Owner");
      const org = await auth.api.createOrganization({
        body: { name: `${slug} org`, slug },
        headers: ownerHeaders,
      });
      const target = await signUpAndVerify(`${slug}-target@example.com`, "Target");
      const added = await testHelpers.addMember?.({
        userId: target.userId,
        organizationId: org!.id,
        role: "member",
      });
      return {
        ownerHeaders,
        organizationId: org!.id,
        memberId: (added as { id: string }).id,
        target,
      };
    }

    async function roleOf(memberId: string): Promise<string | undefined> {
      const [row] = await handle.db
        .select({ role: schema.member.role })
        .from(schema.member)
        .where(eq(schema.member.id, memberId));
      return row?.role;
    }

    async function fillQuota(targetHeaders: Headers, count: number, prefix: string) {
      for (let index = 0; index < count; index += 1) {
        await auth.api.createOrganization({
          body: { name: `${prefix} ${index}`, slug: `${prefix}-${index}` },
          headers: targetHeaders,
        });
      }
    }

    test("rejects the promotion past the limit and leaves the role unchanged", async () => {
      authConfig.DEFAULT_MAX_ORGS_PER_USER = 1;
      const { ownerHeaders, organizationId, memberId, target } = await orgWithMember("r9-1-over");
      await fillQuota(target.headers, 1, "r9-1-over-own");

      await expect(
        auth.api.updateMemberRole({
          body: { memberId, role: "owner", organizationId },
          headers: ownerHeaders,
        }),
      ).rejects.toMatchObject({
        body: { code: "TARGET_REACHED_MAXIMUM_NUMBER_OF_ORGANIZATIONS" },
      });
      expect(await roleOf(memberId)).toBe("member");
    });

    test("rejects when owner is passed in an array alongside other roles", async () => {
      authConfig.DEFAULT_MAX_ORGS_PER_USER = 1;
      const { ownerHeaders, organizationId, memberId, target } = await orgWithMember("r9-1-arr");
      await fillQuota(target.headers, 1, "r9-1-arr-own");

      await expect(
        auth.api.updateMemberRole({
          body: { memberId, role: ["admin", "owner"], organizationId },
          headers: ownerHeaders,
        }),
      ).rejects.toMatchObject({
        body: { code: "TARGET_REACHED_MAXIMUM_NUMBER_OF_ORGANIZATIONS" },
      });
      expect(await roleOf(memberId)).toBe("member");
    });

    test("allows the promotion while the target is under the limit", async () => {
      authConfig.DEFAULT_MAX_ORGS_PER_USER = 2;
      const { ownerHeaders, organizationId, memberId, target } = await orgWithMember("r9-1-ok");
      await fillQuota(target.headers, 1, "r9-1-ok-own");

      await auth.api.updateMemberRole({
        body: { memberId, role: "owner", organizationId },
        headers: ownerHeaders,
      });
      expect(await roleOf(memberId)).toBe("owner");
    });

    test("honors the per-user maxOrganizations override", async () => {
      authConfig.DEFAULT_MAX_ORGS_PER_USER = 1;
      const { ownerHeaders, organizationId, memberId, target } = await orgWithMember("r9-1-ovr");
      await fillQuota(target.headers, 1, "r9-1-ovr-own");
      await handle.db
        .update(schema.user)
        .set({ maxOrganizations: 2 })
        .where(eq(schema.user.id, target.userId));

      await auth.api.updateMemberRole({
        body: { memberId, role: "owner", organizationId },
        headers: ownerHeaders,
      });
      expect(await roleOf(memberId)).toBe("owner");
    });

    test("does not affect changes to non-owner roles for a user at the limit", async () => {
      authConfig.DEFAULT_MAX_ORGS_PER_USER = 1;
      const { ownerHeaders, organizationId, memberId, target } = await orgWithMember("r9-1-non");
      await fillQuota(target.headers, 1, "r9-1-non-own");

      await auth.api.updateMemberRole({
        body: { memberId, role: "admin", organizationId },
        headers: ownerHeaders,
      });
      expect(await roleOf(memberId)).toBe("admin");
    });

    test("does not count a role change of someone who is already an owner", async () => {
      authConfig.DEFAULT_MAX_ORGS_PER_USER = 1;
      const { ownerHeaders, organizationId, memberId, target } = await orgWithMember("r9-1-own");
      await fillQuota(target.headers, 1, "r9-1-own-own");
      // Already an owner here (past the limit via a direct write); keeping owner is not a promotion.
      await handle.db
        .update(schema.member)
        .set({ role: "owner" })
        .where(eq(schema.member.id, memberId));

      await auth.api.updateMemberRole({
        body: { memberId, role: ["owner", "admin"], organizationId },
        headers: ownerHeaders,
      });
      expect(await roleOf(memberId)).toBe("owner,admin");
    });
  });

  test("R2.1: creating an invitation calls sendInvitation with an accept URL containing the invitation id", async () => {
    const { headers } = await signUpAndVerify("r2-1-owner@example.com", "Inviter");
    const org = await auth.api.createOrganization({
      body: { name: "Invite Org", slug: "invite-org" },
      headers,
    });

    const invitation = await auth.api.createInvitation({
      body: { email: "invitee@example.com", role: "member", organizationId: org!.id },
      headers,
    });

    expect(emailSender.invitations).toHaveLength(1);
    const sent = emailSender.invitations[0];
    expect(sent?.to).toBe("invitee@example.com");
    expect(sent?.organizationName).toBe("Invite Org");
    expect(sent?.acceptUrl).toContain(`/accept-invitation/${invitation?.id}`);
  });
});
