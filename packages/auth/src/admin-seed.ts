import type { Database } from "@base-template/db";
import * as schema from "@base-template/db/schema";
import { eq } from "drizzle-orm";

export type SeedPlatformAdminsResult = {
  /** Emails that were promoted to `superadmin` by this call. */
  promoted: string[];
  /** Emails that already held `superadmin` (no write made — idempotent). */
  alreadySuperadmin: string[];
  /** Emails with no matching account (never created here — sign up first). */
  missing: string[];
};

function hasSuperadminRole(role: string | null): boolean {
  return (role ?? "")
    .split(",")
    .map((value) => value.trim())
    .includes("superadmin");
}

/** Appends `roleToAdd` to a comma-separated role list, preserving the roles already there. */
function appendRole(role: string | null, roleToAdd: string): string {
  const existing = (role ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (!existing.includes(roleToAdd)) {
    existing.push(roleToAdd);
  }
  return existing.join(",");
}

/**
 * R6.1 bootstrap: promotes each email to `superadmin`, idempotently, preserving other roles. Used only
 * by `pnpm db:seed:admins`, never an endpoint. Unknown emails are reported in `missing`, not created.
 */
export async function seedPlatformAdmins(
  db: Database,
  emails: readonly string[],
): Promise<SeedPlatformAdminsResult> {
  const result: SeedPlatformAdminsResult = { promoted: [], alreadySuperadmin: [], missing: [] };

  for (const rawEmail of emails) {
    const email = rawEmail.trim().toLowerCase();
    if (!email) {
      continue;
    }

    const [user] = await db
      .select({ id: schema.user.id, role: schema.user.role })
      .from(schema.user)
      .where(eq(schema.user.email, email))
      .limit(1);

    if (!user) {
      result.missing.push(email);
      continue;
    }
    if (hasSuperadminRole(user.role)) {
      result.alreadySuperadmin.push(email);
      continue;
    }

    await db
      .update(schema.user)
      .set({ role: appendRole(user.role, "superadmin"), updatedAt: new Date() })
      .where(eq(schema.user.id, user.id));
    result.promoted.push(email);
  }

  return result;
}
