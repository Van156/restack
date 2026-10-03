import { businessDayBounds, businessDayOf } from "@base-template/db/lib/business-day";
import type { BusinessDayBounds } from "@base-template/db/lib/business-day";
import * as schema from "@base-template/db/schema";
import { ORPCError } from "@orpc/server";
import { and, asc, eq, gte, inArray, lt } from "drizzle-orm";

import type { DbExecutor } from "./executor";
import { accessibleLocationIds, assertLocationAccess } from "./location-scope";
import type { LocationScopeContext } from "./location-scope";
import type { ReportBill } from "./sales-report";

export type ReportScope = { locationIds: string[]; locations: { id: string; name: string }[] };

/** The Locations a report covers: the filtered one, or every Location the caller may access. */
export async function resolveReportScope(
  context: LocationScopeContext,
  locationId: string | undefined,
): Promise<ReportScope> {
  const ids = locationId
    ? [(await assertLocationAccess(context, locationId)).id]
    : await accessibleLocationIds(context);
  if (ids.length === 0) {
    return { locationIds: [], locations: [] };
  }
  const locations = await context.db
    .select({ id: schema.location.id, name: schema.location.name })
    .from(schema.location)
    .where(
      and(eq(schema.location.organizationId, context.org.id), inArray(schema.location.id, ids)),
    )
    .orderBy(asc(schema.location.name), asc(schema.location.id));
  return { locationIds: locations.map((row) => row.id), locations };
}

/** The business day (default today by the injected clock) and its UTC bounds; BAD_REQUEST when malformed. */
export function resolveReportDay(
  date: string | undefined,
  now: Date,
): { date: string; bounds: BusinessDayBounds } {
  const day = date ?? businessDayOf(now);
  try {
    return { date: day, bounds: businessDayBounds(day) };
  } catch {
    throw new ORPCError("BAD_REQUEST", { message: "date must be a valid YYYY-MM-DD date." });
  }
}

/**
 * Bills settled in `[start, end)` at the given Locations, with their payments. A Bill belongs to
 * the business day it settled; a reopened Bill (no settle time) is excluded until settled again.
 */
export async function loadSettledBills(
  db: DbExecutor,
  target: { organizationId: string; locationIds: string[]; bounds: BusinessDayBounds },
): Promise<ReportBill[]> {
  if (target.locationIds.length === 0) {
    return [];
  }
  const bills = await db
    .select()
    .from(schema.bill)
    .where(
      and(
        eq(schema.bill.organizationId, target.organizationId),
        eq(schema.bill.status, "settled"),
        inArray(schema.bill.locationId, target.locationIds),
        gte(schema.bill.settledAt, target.bounds.start),
        lt(schema.bill.settledAt, target.bounds.end),
      ),
    )
    .orderBy(asc(schema.bill.settledAt), asc(schema.bill.id));
  if (bills.length === 0) {
    return [];
  }
  const payments = await db
    .select()
    .from(schema.payment)
    .where(
      inArray(
        schema.payment.billId,
        bills.map((row) => row.id),
      ),
    )
    .orderBy(asc(schema.payment.recordedAt), asc(schema.payment.createdAt));
  const paymentsOf = new Map<string, ReportBill["payments"]>();
  for (const payment of payments) {
    const list = paymentsOf.get(payment.billId) ?? [];
    list.push({ tender: payment.tender, amount: payment.amount });
    paymentsOf.set(payment.billId, list);
  }
  return bills.map((row) => ({
    id: row.id,
    locationId: row.locationId,
    settledByMemberId: row.settledByMemberId,
    total: row.total ?? 0,
    tip: row.tipAmount,
    payments: paymentsOf.get(row.id) ?? [],
    lines: [],
  }));
}
