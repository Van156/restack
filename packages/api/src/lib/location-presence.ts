import * as schema from "@base-template/db/schema";
import { and, eq, gte, max, sql } from "drizzle-orm";

import type { Clock } from "../context";
import type { DbExecutor } from "./executor";

/** A Location is online while a device or Staff client was seen within this long. */
export const LOCATION_ONLINE_THRESHOLD_MS = 30 * 1000;

/** Staff presence is rewritten at most this often per member and Location. */
export const STAFF_PRESENCE_REFRESH_MS = 10 * 1000;

export type StaffSeen = { organizationId: string; locationId: string; memberId: string };

/**
 * Records that a Staff client is open at the Location. One guarded upsert: a seen-time newer
 * than the refresh interval is left alone, so polling costs no row rewrite.
 */
export async function recordStaffSeen(
  db: DbExecutor,
  clock: Clock,
  seen: StaffSeen,
): Promise<void> {
  const now = clock.now();
  const staleBefore = new Date(now.getTime() - STAFF_PRESENCE_REFRESH_MS);
  await db
    .insert(schema.staffPresence)
    .values({ ...seen, lastSeenAt: now })
    .onConflictDoUpdate({
      target: [schema.staffPresence.memberId, schema.staffPresence.locationId],
      set: { lastSeenAt: now },
      setWhere: sql`${schema.staffPresence.lastSeenAt} < ${staleBefore}`,
    });
}

/** True when an active Paired device or a Staff client was seen within the online threshold. */
export async function isLocationOnline(
  db: DbExecutor,
  clock: Clock,
  locationId: string,
): Promise<boolean> {
  const since = new Date(clock.now().getTime() - LOCATION_ONLINE_THRESHOLD_MS);
  const [device] = await db
    .select({ seenAt: max(schema.pairedDevice.lastSeenAt) })
    .from(schema.pairedDevice)
    .where(
      and(
        eq(schema.pairedDevice.locationId, locationId),
        eq(schema.pairedDevice.status, "active"),
        gte(schema.pairedDevice.lastSeenAt, since),
      ),
    );
  if (device?.seenAt) {
    return true;
  }
  const [staff] = await db
    .select({ seenAt: max(schema.staffPresence.lastSeenAt) })
    .from(schema.staffPresence)
    .where(
      and(
        eq(schema.staffPresence.locationId, locationId),
        gte(schema.staffPresence.lastSeenAt, since),
      ),
    );
  return Boolean(staff?.seenAt);
}
