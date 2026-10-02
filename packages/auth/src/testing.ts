import * as schema from "@base-template/db/schema";
import type { Database } from "@base-template/db";
import { resolveTestDatabaseUrl, TEST_DATABASE_NAME_SUFFIX } from "@base-template/db/testing";
import { splitSetCookieHeader } from "better-auth/cookies";
import { getTableName, isTable, sql } from "drizzle-orm";

import type { AuditEvent, AuditLogger } from "./audit/types";
import type {
  EmailSender,
  SendChangeEmailApprovalInput,
  SendDeleteAccountConfirmationInput,
  SendInvitationInput,
  SendPasswordChangedNoticeInput,
  SendResetPasswordInput,
  SendVerificationInput,
} from "./email";

/** Re-exported for `./testing` importers; the source is `@base-template/db/testing`. */
export { resolveTestDatabaseUrl };

/**
 * Test-only helpers shared by auth and api integration tests (spec §8): recording email and audit
 * fakes, sign-up setup, database URL resolution and table truncation.
 * See docs/architecture/auth.md#test-harness
 */

/** Password every `signUpAndVerify` call uses — test-only, never a real credential. */
export const TEST_PASSWORD = "correct horse battery staple";

/** Truncates every table in the db schema; the list is derived at call time so new tables are never missed. */
export async function truncateAllTables(db: Database): Promise<void> {
  // Refuse to wipe any database not named as a test database, whatever URL was used.
  const result = await db.execute<{ name: string }>(sql`SELECT current_database() AS name`);
  const databaseName = result.rows[0]?.name ?? "";
  if (!databaseName.endsWith(TEST_DATABASE_NAME_SUFFIX)) {
    throw new Error(
      `truncateAllTables: refusing to truncate "${databaseName}"; only databases ending with "${TEST_DATABASE_NAME_SUFFIX}" are allowed.`,
    );
  }

  // The schema union includes enums and relations; widen to unknown[] so `isTable` can narrow.
  const tableNames = (Object.values(schema) as unknown[])
    .filter(isTable)
    .map((table) => getTableName(table));
  if (tableNames.length === 0) {
    return;
  }
  const quotedTableList = tableNames.map((name) => `"${name}"`).join(", ");
  await db.execute(sql`TRUNCATE TABLE ${sql.raw(quotedTableList)} RESTART IDENTITY CASCADE`);
}

/** In-memory `EmailSender` that records every call instead of sending anything (test-only). */
export class RecordingEmailSender implements EmailSender {
  readonly verifications: SendVerificationInput[] = [];
  readonly invitations: SendInvitationInput[] = [];
  readonly resetPasswords: SendResetPasswordInput[] = [];
  readonly changeEmailApprovals: SendChangeEmailApprovalInput[] = [];
  readonly deleteAccountConfirmations: SendDeleteAccountConfirmationInput[] = [];
  readonly passwordChangedNotices: SendPasswordChangedNoticeInput[] = [];
  private nextInvitationError: Error | null = null;

  sendVerification(input: SendVerificationInput): Promise<void> {
    this.verifications.push(input);
    return Promise.resolve();
  }

  sendInvitation(input: SendInvitationInput): Promise<void> {
    if (this.nextInvitationError) {
      const error = this.nextInvitationError;
      this.nextInvitationError = null;
      return Promise.reject(error);
    }
    this.invitations.push(input);
    return Promise.resolve();
  }

  sendResetPassword(input: SendResetPasswordInput): Promise<void> {
    this.resetPasswords.push(input);
    return Promise.resolve();
  }

  sendChangeEmailApproval(input: SendChangeEmailApprovalInput): Promise<void> {
    this.changeEmailApprovals.push(input);
    return Promise.resolve();
  }

  sendDeleteAccountConfirmation(input: SendDeleteAccountConfirmationInput): Promise<void> {
    this.deleteAccountConfirmations.push(input);
    return Promise.resolve();
  }

  sendPasswordChangedNotice(input: SendPasswordChangedNoticeInput): Promise<void> {
    this.passwordChangedNotices.push(input);
    return Promise.resolve();
  }

  /** Makes the next `sendInvitation` reject without touching the caller's DB state. */
  failNextInvitation(message = "simulated invitation send failure"): void {
    this.nextInvitationError = new Error(message);
  }

  reset(): void {
    this.verifications.length = 0;
    this.invitations.length = 0;
    this.resetPasswords.length = 0;
    this.changeEmailApprovals.length = 0;
    this.deleteAccountConfirmations.length = 0;
    this.passwordChangedNotices.length = 0;
    this.nextInvitationError = null;
  }

  /** Extracts the verification token from the most recent email sent to `email`. */
  lastVerificationTokenFor(email: string): string {
    const entry = [...this.verifications].reverse().find((candidate) => candidate.to === email);
    if (!entry) {
      throw new Error(`RecordingEmailSender: no verification email recorded for ${email}`);
    }
    const token = new URL(entry.url).searchParams.get("token");
    if (!token) {
      throw new Error(`RecordingEmailSender: verification URL has no token: ${entry.url}`);
    }
    return token;
  }

  /** Extracts the `token` query param (or last path segment) from the latest URL in `entries` for `email`. */
  private lastUrlTokenFor(
    kind: string,
    entries: ReadonlyArray<{ to: string; url: string }>,
    email: string,
  ): string {
    const entry = [...entries].reverse().find((candidate) => candidate.to === email);
    if (!entry) {
      throw new Error(`RecordingEmailSender: no ${kind} email recorded for ${email}`);
    }
    const url = new URL(entry.url);
    const token = url.searchParams.get("token") ?? url.pathname.split("/").filter(Boolean).pop();
    if (!token) {
      throw new Error(`RecordingEmailSender: ${kind} URL has no token: ${entry.url}`);
    }
    return token;
  }

  lastResetPasswordTokenFor(email: string): string {
    return this.lastUrlTokenFor("reset-password", this.resetPasswords, email);
  }

  lastChangeEmailApprovalTokenFor(email: string): string {
    return this.lastUrlTokenFor("change-email approval", this.changeEmailApprovals, email);
  }

  lastDeleteAccountTokenFor(email: string): string {
    return this.lastUrlTokenFor("delete-account", this.deleteAccountConfirmations, email);
  }

  /** Extracts the invitation accept token from the most recent invitation email sent to `email`. */
  lastInvitationTokenFor(email: string): string {
    const entry = [...this.invitations].reverse().find((candidate) => candidate.to === email);
    if (!entry) {
      throw new Error(`RecordingEmailSender: no invitation email recorded for ${email}`);
    }
    const token = new URL(entry.acceptUrl).searchParams.get("token");
    if (!token) {
      throw new Error(`RecordingEmailSender: invitation URL has no token: ${entry.acceptUrl}`);
    }
    return token;
  }
}

/** In-memory `AuditLogger` that records every event (test-only). */
export class RecordingAuditLogger implements AuditLogger {
  readonly events: AuditEvent[] = [];

  record(event: AuditEvent): Promise<void> {
    this.events.push(event);
    return Promise.resolve();
  }

  reset(): void {
    this.events.length = 0;
  }

  /** All recorded events for the given action, in recorded order. */
  eventsFor(action: AuditEvent["action"]): AuditEvent[] {
    return this.events.filter((event) => event.action === action);
  }
}

/** Structural subset of a `createAuth()` instance that `signUpAndVerify` needs. */
export type SignUpCapableAuth = {
  api: {
    signUpEmail(input: {
      body: { email: string; password: string; name: string };
    }): Promise<{ user: { id: string } }>;
    verifyEmail(input: { query: { token: string }; asResponse: true }): Promise<Response>;
  };
};

/** Signs a user up, verifies via the captured email link, and returns authenticated headers. */
export async function signUpAndVerify(
  auth: SignUpCapableAuth,
  emailSender: RecordingEmailSender,
  email: string,
  name: string,
): Promise<{ headers: Headers; userId: string }> {
  const signUpResult = await auth.api.signUpEmail({
    body: { email, password: TEST_PASSWORD, name },
  });
  const token = emailSender.lastVerificationTokenFor(email);
  const verifyResponse = await auth.api.verifyEmail({ query: { token }, asResponse: true });
  const setCookie = verifyResponse.headers.get("set-cookie");
  if (!setCookie) {
    throw new Error("verifyEmail did not set a session cookie");
  }
  const cookiePair = setCookie.split(";")[0] ?? "";
  return { headers: new Headers({ cookie: cookiePair }), userId: signUpResult.user.id };
}

/**
 * Builds a request `Cookie` header from `set-cookie`, keeping the last value per name and dropping
 * cleared cookies. `Headers.get` comma-joins entries, so `split(";")[0]` would take a cleared one.
 * See docs/architecture/auth.md#test-harness
 */
export function cookieHeaderFromSetCookie(setCookieHeader: string | null): Headers {
  const cookiesByName = new Map<string, string>();
  for (const raw of splitSetCookieHeader(setCookieHeader ?? "")) {
    const pair = raw.split(";")[0]?.trim();
    if (!pair) {
      continue;
    }
    const separatorIndex = pair.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }
    const name = pair.slice(0, separatorIndex);
    const value = pair.slice(separatorIndex + 1);
    if (!value) {
      // Cleared cookie: drop it so it cannot shadow a later real one.
      cookiesByName.delete(name);
      continue;
    }
    cookiesByName.set(name, value); // later entries win
  }
  const cookieHeader = [...cookiesByName].map(([name, value]) => `${name}=${value}`).join("; ");
  return new Headers({ cookie: cookieHeader });
}
