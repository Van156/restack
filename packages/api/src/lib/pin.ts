import { verifyPin } from "@base-template/auth/staff-credentials";
import * as schema from "@base-template/db/schema";
import { ORPCError } from "@orpc/server";
import { and, eq, sql } from "drizzle-orm";

import type { Clock } from "../context";
import type { DbExecutor } from "./executor";

/** Wrong PINs in a row before the Staff member is locked out. */
export const MAX_FAILED_PIN_ATTEMPTS = 5;
export const PIN_LOCKOUT_MINUTES = 15;

const MINUTE_MS = 60 * 1000;
const INCORRECT = "Incorrect PIN.";

/**
 * Checks a Staff member's PIN with attempt counting and temporary lockout. Resolves on a correct
 * PIN (and clears the counter); otherwise throws FORBIDDEN (wrong PIN, or none set: the same
 * answer, so a PIN-less member is not distinguishable) or TOO_MANY_REQUESTS while locked out.
 * The failed attempt is persisted before throwing, so it counts even though the call fails.
 */
export async function verifyMemberPin(
  db: DbExecutor,
  clock: Clock,
  input: { organizationId: string; memberId: string; pin: string },
): Promise<void> {
  const now = clock.now();
  const where = and(
    eq(schema.staffPin.organizationId, input.organizationId),
    eq(schema.staffPin.memberId, input.memberId),
  );
  const [row] = await db.select().from(schema.staffPin).where(where);
  if (!row) {
    throw new ORPCError("FORBIDDEN", { message: INCORRECT });
  }
  if (row.lockedUntil && row.lockedUntil > now) {
    throw new ORPCError("TOO_MANY_REQUESTS", {
      message: "Too many wrong PINs. Try again later.",
      data: { lockedUntil: row.lockedUntil },
    });
  }

  if (await verifyPin(input.pin, row.pinHash)) {
    if (row.failedAttempts > 0 || row.lockedUntil) {
      await db.update(schema.staffPin).set({ failedAttempts: 0, lockedUntil: null }).where(where);
    }
    return;
  }

  // A lock that already ran out starts a fresh count.
  if (row.lockedUntil) {
    await db.update(schema.staffPin).set({ failedAttempts: 0, lockedUntil: null }).where(where);
  }
  const [updated] = await db
    .update(schema.staffPin)
    .set({ failedAttempts: sql`${schema.staffPin.failedAttempts} + 1` })
    .where(where)
    .returning({ failedAttempts: schema.staffPin.failedAttempts });
  if ((updated?.failedAttempts ?? 0) >= MAX_FAILED_PIN_ATTEMPTS) {
    await db
      .update(schema.staffPin)
      .set({ lockedUntil: new Date(now.getTime() + PIN_LOCKOUT_MINUTES * MINUTE_MS) })
      .where(where);
  }
  throw new ORPCError("FORBIDDEN", { message: INCORRECT });
}
