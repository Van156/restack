import * as schema from "@base-template/db/schema";
import { and, eq, inArray, ne } from "drizzle-orm";

import type { Clock } from "../context";
import type { DbExecutor } from "./executor";

/** Attends the unfinished calls of one Table session; no cooldown, the session is over. */
export async function closeCallsOfSession(
  db: DbExecutor,
  clock: Clock,
  tableSessionId: string,
): Promise<void> {
  await db
    .update(schema.waiterCall)
    .set({ status: "attended", resolvedAt: clock.now() })
    .where(
      and(
        eq(schema.waiterCall.tableSessionId, tableSessionId),
        ne(schema.waiterCall.status, "attended"),
      ),
    );
}

/**
 * Attends the unfinished calls of every settled session: the fallback for a settle that did not
 * go through the request path. Returns how many it closed.
 */
export async function closeSettledSessionCalls(db: DbExecutor, clock: Clock): Promise<number> {
  const closed = await db
    .update(schema.waiterCall)
    .set({ status: "attended", resolvedAt: clock.now() })
    .where(
      and(
        ne(schema.waiterCall.status, "attended"),
        inArray(
          schema.waiterCall.tableSessionId,
          db
            .select({ id: schema.tableSession.id })
            .from(schema.tableSession)
            .where(eq(schema.tableSession.status, "settled")),
        ),
      ),
    )
    .returning({ id: schema.waiterCall.id });
  return closed.length;
}
