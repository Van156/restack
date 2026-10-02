// Promotes each email listed in PLATFORM_ADMIN_EMAILS (comma-separated) to
// the platform `superadmin` role (R6.1: bootstrap the first superadmin via a
// seed command, never through a public endpoint). Usage: `pnpm db:seed:admins`.
//
// The actual logic (idempotent promotion; an email with no existing account
// is reported, never created) lives in `@base-template/auth/admin-seed` so it
// stays unit-testable against a real database without needing a CLI process
// — see `packages/auth/src/admin-seed.integration.test.ts`.
import { seedPlatformAdmins } from "@base-template/auth/admin-seed";

import { ENV } from "../src/env.server";
import { db } from "../src/services";

function parseEmails(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((email) => email.trim())
    .filter(Boolean);
}

async function main(): Promise<void> {
  const emails = parseEmails(ENV.PLATFORM_ADMIN_EMAILS);
  if (emails.length === 0) {
    console.log("[seed-admins] PLATFORM_ADMIN_EMAILS is not set; nothing to do.");
    return;
  }

  const result = await seedPlatformAdmins(db, emails);
  for (const email of result.promoted) {
    console.log(`[seed-admins] promoted ${email} to superadmin.`);
  }
  for (const email of result.alreadySuperadmin) {
    console.log(`[seed-admins] ${email} is already superadmin, skipping.`);
  }
  for (const email of result.missing) {
    console.warn(`[seed-admins] no account found for ${email}; sign up first, then re-run.`);
  }
}

try {
  await main();
} finally {
  await db.$client.end();
}
