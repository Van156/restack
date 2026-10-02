// Creates the dedicated integration-test database (if missing) and applies
// all migrations to it. Usage: `pnpm db:test:prepare`.
// Reads TEST_DATABASE_URL, defaulting to the local docker test database; the
// database name must end with "_test" so this can never target a real database.
import { Client } from "pg";

import { resolveTestDatabaseUrl, TEST_DATABASE_NAME_SUFFIX } from "../src/testing";

const testUrl = new URL(resolveTestDatabaseUrl());
const databaseName = decodeURIComponent(testUrl.pathname.slice(1));
if (!databaseName.endsWith(TEST_DATABASE_NAME_SUFFIX)) {
  throw new Error(
    `prepare-test-db: "${databaseName}" must end with "${TEST_DATABASE_NAME_SUFFIX}".`,
  );
}

const adminUrl = new URL(testUrl);
adminUrl.pathname = "/postgres";
const admin = new Client({ connectionString: adminUrl.toString() });
await admin.connect();
try {
  const existing = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [
    databaseName,
  ]);
  if (existing.rowCount === 0) {
    await admin.query(`CREATE DATABASE "${databaseName.replaceAll('"', '""')}"`);
    console.log(`prepare-test-db: created ${databaseName}`);
  }
} finally {
  await admin.end();
}

const migrate = Bun.spawnSync(["pnpm", "exec", "drizzle-kit", "migrate"], {
  cwd: new URL("..", import.meta.url).pathname,
  env: { ...process.env, DATABASE_URL: testUrl.toString() },
  stdout: "inherit",
  stderr: "inherit",
});
process.exit(migrate.exitCode ?? 1);
