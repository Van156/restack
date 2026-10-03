import * as schema from "@base-template/db/schema";
import {
  DIAN_DOCUMENT_KINDS,
  DIAN_DOCUMENT_STATUSES,
} from "@base-template/db/schema/restaurant-dian";
import { and, eq, gte, inArray, lt } from "drizzle-orm";
import { z } from "zod";

import { orgProcedure, requirePermission } from "../../index";
import {
  loadSettledBills,
  resolveReportDay,
  resolveReportScope,
} from "../../lib/sales-report-data";
import {
  summarizeByItem,
  summarizeByStaff,
  summarizeMargin,
  summarizeTenders,
} from "../../lib/sales-report";
import { summarize } from "./kitchen-metrics";

const reportInput = z.object({
  /** One Location; omitted means every Location the caller may access. */
  locationId: z.string().min(1).optional(),
  /** Bogota business day (`YYYY-MM-DD`); default today by the injected clock. */
  date: z.string().optional(),
});

/** Reports are for management: `report:read` (Owner, Administrator) plus Location scope. */
const reportProcedure = orgProcedure.use(requirePermission({ report: ["read"] }));

/** See docs/architecture/restaurant.md#reports */
export const reportsRouter = {
  /** Sales by tender, tips apart, Bill and DIAN document counts for one business day. */
  daily: reportProcedure.input(reportInput).handler(async ({ context, input }) => {
    const scope = await resolveReportScope(context, input.locationId);
    const day = resolveReportDay(input.date, context.clock.now());
    const bills = await loadSettledBills(context.db, {
      organizationId: context.org.id,
      locationIds: scope.locationIds,
      bounds: day.bounds,
    });

    const documentRows =
      scope.locationIds.length === 0
        ? []
        : await context.db
            .select({ kind: schema.dianDocument.kind, status: schema.dianDocument.status })
            .from(schema.dianDocument)
            .where(
              and(
                eq(schema.dianDocument.organizationId, context.org.id),
                inArray(schema.dianDocument.locationId, scope.locationIds),
                gte(schema.dianDocument.saleTime, day.bounds.start),
                lt(schema.dianDocument.saleTime, day.bounds.end),
              ),
            );
    const byStatus = Object.fromEntries(DIAN_DOCUMENT_STATUSES.map((status) => [status, 0]));
    const byKind = Object.fromEntries(DIAN_DOCUMENT_KINDS.map((kind) => [kind, 0]));
    for (const row of documentRows) {
      byStatus[row.status] = (byStatus[row.status] ?? 0) + 1;
      byKind[row.kind] = (byKind[row.kind] ?? 0) + 1;
    }

    return {
      date: day.date,
      ...summarizeTenders(bills),
      byLocation: scope.locations.map((location) => ({
        locationId: location.id,
        name: location.name,
        ...summarizeTenders(bills.filter((bill) => bill.locationId === location.id)),
      })),
      documents: {
        total: documentRows.length,
        byStatus: byStatus as Record<(typeof DIAN_DOCUMENT_STATUSES)[number], number>,
        byKind: byKind as Record<(typeof DIAN_DOCUMENT_KINDS)[number], number>,
      },
    };
  }),

  /** Kitchen timing (preparation, pickup wait, sent to ready) for Tickets sent that day, per Location and in total. */
  kitchen: reportProcedure.input(reportInput).handler(async ({ context, input }) => {
    const scope = await resolveReportScope(context, input.locationId);
    const day = resolveReportDay(input.date, context.clock.now());
    const tickets =
      scope.locationIds.length === 0
        ? []
        : await context.db
            .select()
            .from(schema.ticket)
            .where(
              and(
                eq(schema.ticket.organizationId, context.org.id),
                inArray(schema.ticket.locationId, scope.locationIds),
                gte(schema.ticket.sentAt, day.bounds.start),
                lt(schema.ticket.sentAt, day.bounds.end),
              ),
            );
    return {
      date: day.date,
      total: summarize(tickets),
      byLocation: scope.locations.map((location) => ({
        locationId: location.id,
        name: location.name,
        ...summarize(tickets.filter((ticket) => ticket.locationId === location.id)),
      })),
    };
  }),

  /** Quantity, recorded revenue, cost and margin per Menu item; items without a cost are flagged. */
  byItem: reportProcedure.input(reportInput).handler(async ({ context, input }) => {
    const scope = await resolveReportScope(context, input.locationId);
    const day = resolveReportDay(input.date, context.clock.now());
    const bills = await loadSettledBills(context.db, {
      organizationId: context.org.id,
      locationIds: scope.locationIds,
      bounds: day.bounds,
    });
    return {
      date: day.date,
      items: summarizeByItem(bills),
      total: summarizeMargin(bills.flatMap((bill) => bill.lines)),
    };
  }),

  /** Sales, tips and margin per Staff member who settled the Bills. */
  byStaff: reportProcedure.input(reportInput).handler(async ({ context, input }) => {
    const scope = await resolveReportScope(context, input.locationId);
    const day = resolveReportDay(input.date, context.clock.now());
    const bills = await loadSettledBills(context.db, {
      organizationId: context.org.id,
      locationIds: scope.locationIds,
      bounds: day.bounds,
    });
    const summaries = summarizeByStaff(bills);
    const memberIds = summaries.flatMap((row) => (row.memberId ? [row.memberId] : []));
    const names =
      memberIds.length === 0
        ? []
        : await context.db
            .select({ memberId: schema.member.id, name: schema.user.name })
            .from(schema.member)
            .innerJoin(schema.user, eq(schema.user.id, schema.member.userId))
            .where(
              and(
                eq(schema.member.organizationId, context.org.id),
                inArray(schema.member.id, memberIds),
              ),
            );
    const nameOf = new Map(names.map((row) => [row.memberId, row.name]));
    return {
      date: day.date,
      staff: summaries.map((row) => ({
        ...row,
        name: row.memberId ? (nameOf.get(row.memberId) ?? null) : null,
      })),
    };
  }),
};
