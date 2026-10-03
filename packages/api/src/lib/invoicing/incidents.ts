import * as schema from "@base-template/db/schema";
import { and, eq, isNull, sql } from "drizzle-orm";

import type { DbExecutor } from "../executor";

export type IncidentCause = "provider_unavailable" | "offline_sale";

/** Opens the Location's incident unless one is already open (at most one per Location). */
export async function openIncident(
  db: DbExecutor,
  target: { organizationId: string; locationId: string; cause: IncidentCause; startedAt: Date },
): Promise<void> {
  await db.insert(schema.dianIncident).values(target).onConflictDoNothing();
}

/** Counts a transmitted document in the Location's open incident, if any. */
export async function countDocumentInIncident(db: DbExecutor, locationId: string): Promise<void> {
  await db
    .update(schema.dianIncident)
    .set({ documentsCovered: sql`${schema.dianIncident.documentsCovered} + 1` })
    .where(
      and(eq(schema.dianIncident.locationId, locationId), isNull(schema.dianIncident.endedAt)),
    );
}

/** Closes the Location's open incident once its outbox has nothing left to transmit. */
export async function closeIncidentIfDrained(
  db: DbExecutor,
  locationId: string,
  now: Date,
): Promise<void> {
  const [pending] = await db
    .select({ id: schema.dianOutbox.id })
    .from(schema.dianOutbox)
    .where(and(eq(schema.dianOutbox.locationId, locationId), isNull(schema.dianOutbox.completedAt)))
    .limit(1);
  if (pending) {
    return;
  }
  await db
    .update(schema.dianIncident)
    .set({ endedAt: now })
    .where(
      and(eq(schema.dianIncident.locationId, locationId), isNull(schema.dianIncident.endedAt)),
    );
}
