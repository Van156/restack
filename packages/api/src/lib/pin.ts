import { verifyPin } from "@base-template/auth/staff-credentials";
import * as schema from "@base-template/db/schema";
import { ORPCError } from "@orpc/server";
import { and, eq, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";

import type { Clock } from "../context";
import type { DbExecutor } from "./executor";

/** Wrong PINs in a row before the Staff member is locked out. */
export const MAX_FAILED_PIN_ATTEMPTS = 5;
export const PIN_LOCKOUT_MINUTES = 15;

const MINUTE_MS = 60 * 1000;
const INCORRECT = "Incorrect PIN.";

/**
 * Checks a PIN with attempt counting and lockout: resolves when correct, else FORBIDDEN (also when
 * no PIN is set) or TOO_MANY_REQUESTS. See docs/architecture/restaurant.md#pins-and-lockout.
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
      await resetPinLockout(db, where);
    }
    return;
  }

  // One guarded UPDATE counts and locks, so concurrent wrong guesses cannot undercount.
  const lockedUntil = new Date(now.getTime() + PIN_LOCKOUT_MINUTES * MINUTE_MS);
  const lapsed = sql`(${schema.staffPin.lockedUntil} IS NOT NULL AND ${schema.staffPin.lockedUntil} <= ${now})`;
  const count = sql`(CASE WHEN ${lapsed} THEN 1 ELSE ${schema.staffPin.failedAttempts} + 1 END)`;
  await db
    .update(schema.staffPin)
    .set({
      failedAttempts: count,
      lockedUntil: sql`(CASE WHEN ${count} >= ${MAX_FAILED_PIN_ATTEMPTS} THEN ${lockedUntil}
        WHEN ${lapsed} THEN NULL ELSE ${schema.staffPin.lockedUntil} END)`,
    })
    .where(where);
  throw new ORPCError("FORBIDDEN", { message: INCORRECT });
}

/** Clears the failed-attempt counter and any lockout. */
export function resetPinLockout(db: DbExecutor, where: SQL | undefined) {
  return db.update(schema.staffPin).set({ failedAttempts: 0, lockedUntil: null }).where(where);
}
