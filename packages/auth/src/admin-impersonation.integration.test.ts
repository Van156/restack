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
  truncateAllTables,
} from "./testing";

/**
 * Integration tests for R6.4's impersonation guarantees against a real
 * Postgres database, exercised directly through `auth.api.*` — the same
 * surface `/api/auth/*` proxies to in `apps/server/src/index.ts` (wired
 * since T2). `packages/api/src/routers/platform.ts` deliberately does NOT
 * wrap impersonate/stop-impersonating in a custom oRPC procedure (see that
 * file's doc comment on why), so this is where R6.4 is verified for T6.
 * Skips cleanly locally (fails loudly in CI) when no test database is
 * reachable (T5b).
 */
const TEST_DATABASE_URL = resolveTestDatabaseUrl();

const reachable = await requireTestDatabaseOrSkip(TEST_DATABASE_URL, "admin impersonation (R6.4)");

describe.skipIf(!reachable)("admin impersonation (R6.4)", () => {
  let handle: TestDatabaseHandle;
  let emailSender: RecordingEmailSender;
  let auditLogger: RecordingAuditLogger;
  let auth: ReturnType<typeof createAuth>;
  let testHelpers: TestHelpers;

  beforeAll(async () => {
    handle = createTestDatabase(TEST_DATABASE_URL);
    emailSender = new RecordingEmailSender();
    auditLogger = new RecordingAuditLogger();
    const authConfig: AuthConfig = {
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
    await truncateAllTables(handle.db);
  });

  function signUpAndVerify(email: string, name: string) {
    return sharedSignUpAndVerify(auth, emailSender, email, name);
  }

  async function superadminHeaders(): Promise<{ headers: Headers; userId: string }> {
    const user = testHelpers.createUser({ role: "superadmin" });
    await testHelpers.saveUser(user);
    const { headers } = await testHelpers.login({ userId: user.id });
    return { headers, userId: user.id };
  }

  test("a superadmin can impersonate a non-superadmin user; the session carries impersonatedBy", async () => {
    const { userId: targetId } = await signUpAndVerify("target@example.com", "Target");
    const { headers: superadminHeadersValue, userId: superadminId } = await superadminHeaders();

    const result = await auth.api.impersonateUser({
      body: { userId: targetId },
      headers: superadminHeadersValue,
    });

    // `impersonatedBy` is an admin-plugin session field not reflected in
    // `impersonateUser`'s inferred base return type.
    const session = result.session as unknown as { impersonatedBy: string; userId: string };
    expect(session.impersonatedBy).toBe(superadminId);
    expect(session.userId).toBe(targetId);
  });

  test("expires the impersonation session after 1h (R6.4)", async () => {
    const { userId: targetId } = await signUpAndVerify("target-expiry@example.com", "Target");
    const { headers: superadminHeadersValue } = await superadminHeaders();
    const before = Date.now();

    const result = await auth.api.impersonateUser({
      body: { userId: targetId },
      headers: superadminHeadersValue,
    });

    const secondsUntilExpiry = (new Date(result.session.expiresAt).getTime() - before) / 1000;
    expect(secondsUntilExpiry).toBeGreaterThan(3595); // ~1h, allowing test execution slack
    expect(secondsUntilExpiry).toBeLessThanOrEqual(3601);
  });

  test("a superadmin cannot impersonate another superadmin", async () => {
    const { headers: superadminHeadersValue } = await superadminHeaders();
    const otherSuperadmin = testHelpers.createUser({ role: "superadmin" });
    await testHelpers.saveUser(otherSuperadmin);

    await expect(
      auth.api.impersonateUser({
        body: { userId: otherSuperadmin.id },
        headers: superadminHeadersValue,
      }),
    ).rejects.toThrow();
  });

  test("a non-superadmin cannot impersonate anyone (R6.5 layer isolation)", async () => {
    const { headers: ownerHeaders } = await signUpAndVerify("owner@example.com", "Owner");
    const { userId: targetId } = await signUpAndVerify("target-2@example.com", "Target");

    await expect(
      auth.api.impersonateUser({ body: { userId: targetId }, headers: ownerHeaders }),
    ).rejects.toThrow();
  });

  test("stop-impersonating restores the superadmin's own session", async () => {
    const { userId: targetId } = await signUpAndVerify("target-stop@example.com", "Target");
    const { headers: superadminHeadersValue, userId: superadminId } = await superadminHeaders();

    const impersonation = await auth.api.impersonateUser({
      body: { userId: targetId },
      headers: superadminHeadersValue,
      asResponse: true,
    });
    const { cookieHeaderFromSetCookie } = await import("./testing");
    const impersonatedHeaders = cookieHeaderFromSetCookie(impersonation.headers.get("set-cookie"));

    const stopResult = await auth.api.stopImpersonating({ headers: impersonatedHeaders });

    expect(stopResult.user.id).toBe(superadminId);
    expect(stopResult.session.impersonatedBy).toBeFalsy();
  });
});
