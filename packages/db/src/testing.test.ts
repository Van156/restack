import { afterEach, describe, expect, test } from "bun:test";

import {
  createTestDatabase,
  DEFAULT_TEST_DATABASE_URL,
  isDatabaseReachable,
  requireTestDatabaseOrSkip,
  resolveTestDatabaseUrl,
  TEST_DATABASE_NAME_SUFFIX,
} from "./testing";

/**
 * Runs `fn` with `process.env.DATABASE_URL` unset, restoring the original
 * value afterwards. `createTestDatabase`/`isDatabaseReachable` fall back to
 * `process.env.DATABASE_URL` when their argument is `undefined`, so the
 * "no URL available" behavior must be tested independently of whatever the
 * ambient test-runner environment happens to have set (e.g. the DB
 * integration tests in `packages/auth` require `DATABASE_URL` to be set for
 * the very same `bun test` invocation).
 */
async function withoutDatabaseUrlEnv<T>(fn: () => T | Promise<T>): Promise<T> {
  const original = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  try {
    return await fn();
  } finally {
    if (original !== undefined) {
      process.env.DATABASE_URL = original;
    }
  }
}

describe("createTestDatabase", () => {
  test("throws a clear error when no DATABASE_URL is available", async () => {
    await withoutDatabaseUrlEnv(() => {
      expect(() => createTestDatabase(undefined)).toThrow(/DATABASE_URL is not set/);
    });
  });
});

describe("isDatabaseReachable", () => {
  test("resolves to false when no DATABASE_URL is available, without connecting", async () => {
    await withoutDatabaseUrlEnv(async () => {
      expect(await isDatabaseReachable(undefined)).toBe(false);
    });
  });

  test("resolves to false (never throws) for a malformed DATABASE_URL", async () => {
    await expect(isDatabaseReachable("not-a-postgres-url")).resolves.toBe(false);
  });

  test("resolves to false (never hangs) when the host is unreachable, within the connect timeout", async () => {
    const start = Date.now();
    const reachable = await isDatabaseReachable(
      "postgresql://postgres:password@10.255.255.1:5432/nope",
      500,
    );
    expect(reachable).toBe(false);
    expect(Date.now() - start).toBeLessThan(5000);
  });
});

describe("resolveTestDatabaseUrl / DEFAULT_TEST_DATABASE_URL / TEST_DATABASE_NAME_SUFFIX (T5c)", () => {
  test("DEFAULT_TEST_DATABASE_URL ends with the _test suffix", () => {
    expect(DEFAULT_TEST_DATABASE_URL.endsWith(TEST_DATABASE_NAME_SUFFIX)).toBe(true);
  });

  test("resolveTestDatabaseUrl falls back to DEFAULT_TEST_DATABASE_URL and ignores DATABASE_URL", () => {
    const originalTestUrl = process.env.TEST_DATABASE_URL;
    const originalDatabaseUrl = process.env.DATABASE_URL;
    delete process.env.TEST_DATABASE_URL;
    process.env.DATABASE_URL = "postgresql://postgres:password@localhost:5432/some-real-db";
    try {
      expect(resolveTestDatabaseUrl()).toBe(DEFAULT_TEST_DATABASE_URL);
    } finally {
      if (originalTestUrl === undefined) {
        delete process.env.TEST_DATABASE_URL;
      } else {
        process.env.TEST_DATABASE_URL = originalTestUrl;
      }
      if (originalDatabaseUrl === undefined) {
        delete process.env.DATABASE_URL;
      } else {
        process.env.DATABASE_URL = originalDatabaseUrl;
      }
    }
  });
});

describe("requireTestDatabaseOrSkip (T5b)", () => {
  const originalCi = process.env.CI;

  afterEach(() => {
    if (originalCi === undefined) {
      delete process.env.CI;
    } else {
      process.env.CI = originalCi;
    }
  });

  test("returns true without throwing when the database is reachable", async () => {
    // The real local test database (see DEFAULT_TEST_DATABASE_URL) must be up
    // for the rest of the integration suite to run at all, so this doubles as
    // a sanity check on that assumption.
    process.env.CI = "true";
    await expect(requireTestDatabaseOrSkip(DEFAULT_TEST_DATABASE_URL, "sanity")).resolves.toBe(
      true,
    );
  });

  test("throws instead of skipping when CI is set and the database is unreachable", async () => {
    process.env.CI = "true";
    await expect(
      requireTestDatabaseOrSkip(
        "postgresql://postgres:password@10.255.255.1:5432/nope_test",
        "my suite",
      ),
    ).rejects.toThrow(/my suite.*unreachable in CI/);
  });

  test("returns false (does not throw) locally when CI is unset and the database is unreachable", async () => {
    delete process.env.CI;
    await expect(
      requireTestDatabaseOrSkip(
        "postgresql://postgres:password@10.255.255.1:5432/nope_test",
        "my suite",
      ),
    ).resolves.toBe(false);
  });
});
