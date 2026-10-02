import { createTestDatabase, requireTestDatabaseOrSkip } from "@base-template/db/testing";
import type { TestDatabaseHandle } from "@base-template/db/testing";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { testUtils } from "better-auth/plugins";
import type { TestHelpers } from "better-auth/plugins";

import type { AuthConfig } from "./index";
import { createAuth } from "./index";
import {
  RecordingAuditLogger,
  RecordingEmailSender,
  resolveTestDatabaseUrl,
  signUpAndVerify as sharedSignUpAndVerify,
  truncateAllTables,
} from "./testing";

/**
 * Google sign-in (docs/specs/dashboard-shell-and-auth-ui.md R5.1-R5.6).
 * No real OAuth app: Google's token endpoint is stubbed through `fetch`, and
 * the ID token is an unsigned JWT (better-auth 1.7.5's Google provider only
 * decodes it in `getUserInfo`). Skips cleanly without a test database.
 */
const TEST_DATABASE_URL = resolveTestDatabaseUrl();
const reachable = await requireTestDatabaseOrSkip(TEST_DATABASE_URL, "google sign-in (R5)");

const BASE_URL = "http://localhost:3000";
const WEB_ORIGIN = "http://localhost:3001";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

function base64url(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function fakeGoogleIdToken(claims: {
  sub: string;
  email: string;
  email_verified: boolean;
  name: string;
}): string {
  return `${base64url({ alg: "none", typ: "JWT" })}.${base64url(claims)}.sig`;
}

describe.skipIf(!reachable)("google sign-in (R5)", () => {
  let handle: TestDatabaseHandle;
  let emailSender: RecordingEmailSender;
  let authConfig: AuthConfig;
  let auth: ReturnType<typeof createAuth>;
  let testHelpers: TestHelpers;
  const realFetch = globalThis.fetch;
  let nextGoogleIdToken = "";

  beforeAll(async () => {
    handle = createTestDatabase(TEST_DATABASE_URL);
    emailSender = new RecordingEmailSender();
    authConfig = {
      BETTER_AUTH_URL: BASE_URL,
      BETTER_AUTH_SECRET: "a-32-character-long-test-secret",
      CORS_ORIGIN: WEB_ORIGIN,
      DEFAULT_MAX_ORGS_PER_USER: 10,
      GOOGLE_CLIENT_ID: "test-google-client-id",
      GOOGLE_CLIENT_SECRET: "test-google-client-secret",
    };
    auth = createAuth(authConfig, handle.db, emailSender, new RecordingAuditLogger(), {
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
    await truncateAllTables(handle.db);
    // Provider HTTP mocked: only Google's token endpoint is intercepted.
    globalThis.fetch = Object.assign(
      async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const url = input instanceof Request ? input.url : String(input);
        if (url === GOOGLE_TOKEN_URL) {
          return Response.json({
            access_token: "google-access-token",
            token_type: "Bearer",
            expires_in: 3600,
            id_token: nextGoogleIdToken,
          });
        }
        return realFetch(input, init);
      },
      { preconnect: realFetch.preconnect },
    );
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  function signUpAndVerify(email: string, name: string) {
    return sharedSignUpAndVerify(auth, emailSender, email, name);
  }

  /**
   * Drives the OAuth round trip: `POST /sign-in/social` (state + cookies), then
   * the provider callback with the stubbed Google profile. Returns the final
   * redirect `Location`.
   */
  async function googleRoundTrip(input: {
    profile: { sub: string; email: string; email_verified: boolean; name: string };
    additionalData?: Record<string, unknown>;
  }): Promise<{ location: URL; setCookie: string | null }> {
    const start = await auth.handler(
      new Request(`${BASE_URL}/api/auth/sign-in/social`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: WEB_ORIGIN },
        body: JSON.stringify({
          provider: "google",
          callbackURL: `${WEB_ORIGIN}/dashboard`,
          errorCallbackURL: `${WEB_ORIGIN}/sign-in`,
          additionalData: input.additionalData,
        }),
      }),
    );
    expect(start.status).toBe(200);
    const { url } = (await start.json()) as { url: string };
    const authorizeUrl = new URL(url);
    expect(authorizeUrl.origin + authorizeUrl.pathname).toBe(
      "https://accounts.google.com/o/oauth2/v2/auth",
    );
    const state = authorizeUrl.searchParams.get("state");
    if (!state) {
      throw new Error("authorization URL carries no state");
    }
    const cookie = (start.headers.getSetCookie?.() ?? [])
      .map((value) => value.split(";")[0])
      .join("; ");

    nextGoogleIdToken = fakeGoogleIdToken(input.profile);
    const callback = await auth.handler(
      new Request(`${BASE_URL}/api/auth/callback/google?code=fake-code&state=${state}`, {
        headers: { cookie },
      }),
    );
    expect(callback.status).toBe(302);
    return {
      location: new URL(callback.headers.get("location") ?? ""),
      setCookie: callback.headers.get("set-cookie"),
    };
  }

  async function userExistsForEmail(email: string): Promise<boolean> {
    const context = await auth.$context;
    return Boolean(await context.internalAdapter.findUserByEmail(email));
  }

  async function googleAccountCount(userId: string): Promise<number> {
    const context = await auth.$context;
    const accounts = await context.internalAdapter.findAccounts(userId);
    return accounts.filter((account) => account.providerId === "google").length;
  }

  async function invitationStatus(invitationId: string): Promise<string | undefined> {
    const context = await auth.$context;
    const invitation = await context.adapter.findOne<{ status: string }>({
      model: "invitation",
      where: [{ field: "id", value: invitationId }],
    });
    return invitation?.status;
  }

  describe("R5.1: registration from env", () => {
    test("configured: the social sign-in endpoint returns a Google authorization URL", async () => {
      const response = await auth.handler(
        new Request(`${BASE_URL}/api/auth/sign-in/social`, {
          method: "POST",
          headers: { "content-type": "application/json", origin: WEB_ORIGIN },
          body: JSON.stringify({ provider: "google", callbackURL: `${WEB_ORIGIN}/dashboard` }),
        }),
      );
      expect(response.status).toBe(200);
      const { url } = (await response.json()) as { url: string };
      expect(url.startsWith("https://accounts.google.com/o/oauth2/v2/auth")).toBe(true);
      expect(new URL(url).searchParams.get("client_id")).toBe("test-google-client-id");
    });

    test("absent: Google is not registered (provider not found)", async () => {
      const { GOOGLE_CLIENT_ID: _id, GOOGLE_CLIENT_SECRET: _secret, ...withoutGoogle } = authConfig;
      const plainAuth = createAuth(
        withoutGoogle,
        handle.db,
        emailSender,
        new RecordingAuditLogger(),
      );
      const response = await plainAuth.handler(
        new Request(`${BASE_URL}/api/auth/sign-in/social`, {
          method: "POST",
          headers: { "content-type": "application/json", origin: WEB_ORIGIN },
          body: JSON.stringify({ provider: "google", callbackURL: `${WEB_ORIGIN}/dashboard` }),
        }),
      );
      expect(response.status).toBe(404);
    });

    test("half-configured: createAuth throws naming the missing variable", () => {
      const { GOOGLE_CLIENT_SECRET: _secret, ...idOnly } = authConfig;
      expect(() => createAuth(idOnly, handle.db, emailSender, new RecordingAuditLogger())).toThrow(
        /GOOGLE_CLIENT_SECRET/,
      );
    });
  });

  describe("R5.2: first use creates the account", () => {
    test("a verified Google profile signs up a verified user and lands on the callback URL", async () => {
      const { location, setCookie } = await googleRoundTrip({
        profile: { sub: "g-1", email: "new@example.com", email_verified: true, name: "New User" },
      });
      expect(location.href).toBe(`${WEB_ORIGIN}/dashboard`);
      expect(setCookie).toContain("session_token");
      expect(await userExistsForEmail("new@example.com")).toBe(true);
    });
  });

  describe("R5.4: account linking and email trust", () => {
    test("a verified Google email links to the existing verified email/password account", async () => {
      const { userId } = await signUpAndVerify("linked@example.com", "Linked");

      const { location } = await googleRoundTrip({
        profile: { sub: "g-2", email: "linked@example.com", email_verified: true, name: "Linked" },
      });

      expect(location.href).toBe(`${WEB_ORIGIN}/dashboard`);
      expect(await googleAccountCount(userId)).toBe(1);
    });

    test("an unverified Google email is rejected: not linked, no session", async () => {
      const { userId } = await signUpAndVerify("untrusted@example.com", "Untrusted");

      const { location, setCookie } = await googleRoundTrip({
        profile: {
          sub: "g-3",
          email: "untrusted@example.com",
          email_verified: false,
          name: "Untrusted",
        },
      });

      expect(location.origin + location.pathname).toBe(`${WEB_ORIGIN}/sign-in`);
      expect(location.searchParams.get("error")).toBe("account_not_linked");
      expect(setCookie ?? "").not.toContain("session_token");
      expect(await googleAccountCount(userId)).toBe(0);
    });

    test("an unverified Google email never creates a session for a NEW account either", async () => {
      const { location, setCookie } = await googleRoundTrip({
        profile: { sub: "g-4", email: "fresh@example.com", email_verified: false, name: "Fresh" },
      });
      expect(location.searchParams.get("error")).toBeTruthy();
      expect(setCookie ?? "").not.toContain("session_token");
    });
  });

  describe("R5.5: invitations", () => {
    async function pendingInvitation(inviteeEmail: string) {
      const { headers, userId } = await signUpAndVerify("inviter-owner@example.com", "Owner");
      const org = await auth.api.createOrganization({
        body: { name: "Inviting Org", slug: "inviting-org" },
        headers,
      });
      if (!org) {
        throw new Error("createOrganization returned null");
      }
      const invitation = await auth.api.createInvitation({
        body: { email: inviteeEmail, role: "member", organizationId: org.id },
        headers,
      });
      if (!invitation) {
        throw new Error("createInvitation returned null");
      }
      expect(userId).toBeTruthy();
      return { invitationId: invitation.id, organizationId: org.id };
    }

    test("email mismatch: rejected BEFORE the user is created; invitation untouched", async () => {
      const { invitationId } = await pendingInvitation("invited@example.com");

      const { location, setCookie } = await googleRoundTrip({
        profile: { sub: "g-5", email: "other@example.com", email_verified: true, name: "Other" },
        additionalData: { invitationId },
      });

      expect(location.origin + location.pathname).toBe(`${WEB_ORIGIN}/sign-in`);
      expect(location.searchParams.get("error")).toBe("INVITATION_EMAIL_MISMATCH");
      expect(setCookie ?? "").not.toContain("session_token");
      expect(await userExistsForEmail("other@example.com")).toBe(false);
      expect(await invitationStatus(invitationId)).toBe("pending");
    });

    test("email match: account created verified, session issued, invitation NOT implicitly accepted", async () => {
      const { invitationId } = await pendingInvitation("invited-match@example.com");

      const { location, setCookie } = await googleRoundTrip({
        profile: {
          sub: "g-6",
          email: "invited-match@example.com",
          email_verified: true,
          name: "Invited",
        },
        additionalData: { invitationId },
      });

      expect(location.href).toBe(`${WEB_ORIGIN}/dashboard`);
      expect(setCookie).toContain("session_token");
      expect(await userExistsForEmail("invited-match@example.com")).toBe(true);
      expect(await invitationStatus(invitationId)).toBe("pending");
    });

    test("a social user whose email differs from the invitation is refused by acceptInvitation (R2.5 unchanged)", async () => {
      const { invitationId } = await pendingInvitation("invited-recipient@example.com");
      const { userId } = await signUpAndVerify("not-the-recipient@example.com", "Stranger");
      const strangerHeaders = await testHelpers.login({ userId });

      await expect(
        auth.api.acceptInvitation({
          body: { invitationId },
          headers: strangerHeaders.headers,
        }),
      ).rejects.toThrow();
      expect(await invitationStatus(invitationId)).toBe("pending");
    });
  });
});
