import * as schema from "@base-template/db/schema";
import type { TableSessionStatus } from "@base-template/db/schema/restaurant-orders";
import { and, eq, inArray } from "drizzle-orm";

import type { DbExecutor } from "./executor";

/** A session occupies its Table until it is settled. */
export const UNSETTLED_SESSION_STATUSES: readonly TableSessionStatus[] = ["open", "bill_requested"];

/** True when any Table of the Area has an unsettled Table session (an open Bill). */
export async function hasOpenBillsInArea(db: DbExecutor, areaId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: schema.tableSession.id })
    .from(schema.tableSession)
    .innerJoin(schema.diningTable, eq(schema.diningTable.id, schema.tableSession.tableId))
    .where(
      and(
        eq(schema.diningTable.areaId, areaId),
        inArray(schema.tableSession.status, [...UNSETTLED_SESSION_STATUSES]),
      ),
    )
    .limit(1);
  return Boolean(row);
}

/** True when the Table has an unsettled Table session. */
export async function hasOpenSessionAtTable(db: DbExecutor, tableId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: schema.tableSession.id })
    .from(schema.tableSession)
    .where(
      and(
        eq(schema.tableSession.tableId, tableId),
        inArray(schema.tableSession.status, [...UNSETTLED_SESSION_STATUSES]),
      ),
    )
    .limit(1);
  return Boolean(row);
}
