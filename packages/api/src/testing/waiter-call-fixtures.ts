import * as schema from "@base-template/db/schema";
import { eq } from "drizzle-orm";

import type { RestaurantHarness } from "./restaurant-fixtures";

type CallChanges = Partial<typeof schema.waiterCall.$inferInsert>;

/** Direct database access to Waiter call state for tests that drive the public routes. */
export function waiterCallProbe(harness: RestaurantHarness, tableSessionId: string) {
  const { db } = harness;
  return {
    calls: () =>
      db
        .select()
        .from(schema.waiterCall)
        .where(eq(schema.waiterCall.tableSessionId, tableSessionId)),
    changeCalls: (changes: CallChanges) =>
      db
        .update(schema.waiterCall)
        .set(changes)
        .where(eq(schema.waiterCall.tableSessionId, tableSessionId)),
    settleSession: () =>
      db
        .update(schema.tableSession)
        .set({ status: "settled", settledAt: harness.clock.now() })
        .where(eq(schema.tableSession.id, tableSessionId)),
    forgetStaffPresence: () => db.delete(schema.staffPresence),
  };
}
