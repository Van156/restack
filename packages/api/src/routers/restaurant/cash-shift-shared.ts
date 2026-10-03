import * as schema from "@base-template/db/schema";
import { ORPCError } from "@orpc/server";
import { and, eq } from "drizzle-orm";

import type { CashShiftRow } from "../../lib/cash-shift";
import { assertLocationAccess } from "../../lib/location-scope";
import type { OrderContext } from "./orders-shared";

/** A Cash shift of the caller's organization, with Location access checked. Missing and foreign shifts are both NOT_FOUND. */
export async function loadShiftInScope(
  context: OrderContext,
  cashShiftId: string,
): Promise<CashShiftRow> {
  const [shift] = await context.db
    .select()
    .from(schema.cashShift)
    .where(
      and(
        eq(schema.cashShift.id, cashShiftId),
        eq(schema.cashShift.organizationId, context.org.id),
      ),
    );
  if (!shift) {
    throw new ORPCError("NOT_FOUND", { message: "Cash shift not found." });
  }
  await assertLocationAccess(context, shift.locationId);
  return shift;
}
