import { Pool } from "pg";

import { createDb } from "./index";
import type { Database } from "./index";

/** Default connect timeout for {@link isDatabaseReachable}'s probe connection. */
const DEFAULT_REACHABILITY_TIMEOUT_MS = 3000;

/**
 * Dedicated local test database: never the dev database, never port 5432 (another project may
 * own it). Create it with `db:test:prepare`. `scripts/prepare-test-db.ts` and
 * `@base-template/auth/testing` import this, so the default and the "_test" guard cannot drift.
 * See docs/architecture/auth.md#test-harness.
 */
export const DEFAULT_TEST_DATABASE_URL =
  "postgresql://postgres:password@localhost:5436/base_template_test";

/** Only databases whose name ends with this suffix may be created/truncated by test tooling. */
export const TEST_DATABASE_NAME_SUFFIX = "_test";

/** The URL integration tests use: `TEST_DATABASE_URL` or the default. `DATABASE_URL` is ignored on purpose, so an app `.env` can never redirect tests to a real database. */
export function resolveTestDatabaseUrl(): string {
  return process.env.TEST_DATABASE_URL ?? DEFAULT_TEST_DATABASE_URL;
}

/**
 * Whether a database-backed suite should run. Unreachable in CI (`process.env.CI`) throws, so a
 * broken pipeline cannot go green with zero integration coverage; locally it warns and returns
 * `false` for `describe.skipIf`.
 */
export async function requireTestDatabaseOrSkip(
  databaseUrl: string = resolveTestDatabaseUrl(),
  suiteName = "integration suite",
): Promise<boolean> {
  const reachable = await isDatabaseReachable(databaseUrl);
  if (reachable) {
    return true;
  }
  if (process.env.CI) {
    throw new Error(
      `${suiteName}: test database at ${databaseUrl} is unreachable in CI; refusing to silently skip. Ensure the test database service is up before running tests.`,
    );
  }
  console.warn(
    `[${suiteName}] test database unreachable at ${databaseUrl}; skipping (run \`pnpm db:start\` then \`pnpm db:test:prepare\`).`,
  );
  return false;
}

export type TestDatabaseHandle = {
  db: Database;
  close: () => Promise<void>;
};

/** A Drizzle client for integration tests (defaults to `DATABASE_URL`; tests pass `resolveTestDatabaseUrl()`). Throws without a URL; guard with {@link isDatabaseReachable}. */
export function createTestDatabase(
  databaseUrl: string | undefined = process.env.DATABASE_URL,
): TestDatabaseHandle {
  if (!databaseUrl) {
    throw new Error(
      "createTestDatabase: DATABASE_URL is not set. Guard DB-dependent tests with isDatabaseReachable() first.",
    );
  }
  const db = createDb({ DATABASE_URL: databaseUrl });
  return {
    db,
    close: () => db.$client.end(),
  };
}

/**
 * Whether Postgres answers at `databaseUrl` (defaults to `DATABASE_URL`). Never throws and never hangs: `connectTimeoutMs`
 * bounds the attempt (pg's own default is unlimited) and a failed `end()` cannot override the result.
 */
export async function isDatabaseReachable(
  databaseUrl: string | undefined = process.env.DATABASE_URL,
  connectTimeoutMs: number = DEFAULT_REACHABILITY_TIMEOUT_MS,
): Promise<boolean> {
  if (!databaseUrl) {
    return false;
  }

  try {
    const pool = new Pool({
      connectionString: databaseUrl,
      connectionTimeoutMillis: connectTimeoutMs,
    });
    // A background error (e.g. a reset socket) must not crash the process as an unhandled event.
    pool.on("error", () => {});

    try {
      await pool.query("select 1");
      return true;
    } catch {
      return false;
    } finally {
      try {
        await pool.end();
      } catch {
        // Closing a pool that never connected can reject; the result is already decided.
      }
    }
  } catch {
    // An unparseable connection string must not throw.
    return false;
  }
}
