import { businessDayOf } from "@base-template/db/lib/business-day";
import * as schema from "@base-template/db/schema";
import { sql } from "drizzle-orm";

import type { DbExecutor } from "../executor";

/** Counts one issued document for the Location in the Bogota calendar month of `at`. */
export async function incrementDocumentCounter(
  db: DbExecutor,
  target: { organizationId: string; locationId: string; at: Date },
): Promise<void> {
  await db
    .insert(schema.dianDocumentCounter)
    .values({
      organizationId: target.organizationId,
      locationId: target.locationId,
      month: businessDayOf(target.at).slice(0, 7),
      count: 1,
    })
    .onConflictDoUpdate({
      target: [schema.dianDocumentCounter.locationId, schema.dianDocumentCounter.month],
      set: { count: sql`${schema.dianDocumentCounter.count} + 1` },
    });
}
