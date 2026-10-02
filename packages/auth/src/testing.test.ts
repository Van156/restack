import type { Database } from "@base-template/db";
import { afterEach, describe, expect, test } from "bun:test";

import { resolveTestDatabaseUrl, truncateAllTables } from "./testing";

const originalEnv = {
  DATABASE_URL: process.env.DATABASE_URL,
  TEST_DATABASE_URL: process.env.TEST_DATABASE_URL,
};

afterEach(() => {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
});

/** Fake `Database` that reports `databaseName` and records every executed statement. */
function fakeDatabase(databaseName: string) {
  const executed: unknown[] = [];
  const db = {
    execute: (query: unknown) => {
      executed.push(query);
      return Promise.resolve({ rows: [{ name: databaseName }] });
    },
  } as unknown as Database;
  return { db, executed };
}

describe("resolveTestDatabaseUrl", () => {
  test("ignores DATABASE_URL so an app .env can never redirect tests", () => {
    process.env.DATABASE_URL = "postgresql://postgres:password@localhost:5432/other-project";
    delete process.env.TEST_DATABASE_URL;

    expect(resolveTestDatabaseUrl()).not.toContain("other-project");
    expect(resolveTestDatabaseUrl()).toEndWith("_test");
  });

  test("uses TEST_DATABASE_URL when set", () => {
    process.env.TEST_DATABASE_URL = "postgresql://postgres:password@localhost:5436/custom_test";

    expect(resolveTestDatabaseUrl()).toBe(process.env.TEST_DATABASE_URL);
  });
});

describe("truncateAllTables", () => {
  test("refuses to truncate a database whose name does not end with _test", async () => {
    const { db, executed } = fakeDatabase("base-template");

    await expect(truncateAllTables(db)).rejects.toThrow(/_test/);
    expect(executed).toHaveLength(1); // only the current_database() probe, no TRUNCATE
  });

  test("truncates a database whose name ends with _test", async () => {
    const { db, executed } = fakeDatabase("base_template_test");

    await truncateAllTables(db);

    expect(executed).toHaveLength(2);
  });
});
