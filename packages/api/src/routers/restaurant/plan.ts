import { businessDayOf } from "@base-template/db/lib/business-day";
import { LOCATION_PLANS } from "@base-template/db/schema/restaurant";
import * as schema from "@base-template/db/schema";
import { ORPCError } from "@orpc/server";
import { and, asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { orgProcedure, requirePermission } from "../../index";
import { recordAuditThrough } from "../../lib/audit-in-transaction";
import { planAllowsDian } from "../../lib/invoicing/plan-gate";
import { accessibleLocationIds, assertLocationAccess } from "../../lib/location-scope";
import { exceedsFairUse, trialState } from "../../lib/plan";

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Plans and trial are the Owner's: every procedure needs `subscription:manage`. */
const ownerProcedure = orgProcedure.use(requirePermission({ subscription: ["manage"] }));

/** See docs/architecture/restaurant.md#plans-and-trial */
export const planRouter = {
  /** Plan, trial state and whether DIAN issuing is allowed, for every Location of the Restaurant. */
  list: ownerProcedure.handler(async ({ context }) => {
    const ids = await accessibleLocationIds(context);
    if (ids.length === 0) {
      return [];
    }
    const now = context.clock.now();
    const rows = await context.db
      .select()
      .from(schema.location)
      .where(
        and(eq(schema.location.organizationId, context.org.id), inArray(schema.location.id, ids)),
      )
      .orderBy(asc(schema.location.name), asc(schema.location.id));
    return rows.map((row) => ({
      locationId: row.id,
      name: row.name,
      plan: row.plan,
      trial: trialState(row, now),
      dianAllowed: planAllowsDian(row, now),
    }));
  }),

  /** Sets the Plan of one Location; the change is audited in the same transaction, an unchanged Plan is not. */
  set: ownerProcedure
    .input(z.object({ locationId: z.string().min(1), plan: z.enum(LOCATION_PLANS) }))
    .handler(async ({ context, input }) => {
      const location = await assertLocationAccess(context, input.locationId);
      if (location.plan === input.plan) {
        return location;
      }
      return context.db.transaction(async (tx) => {
        const [updated] = await tx
          .update(schema.location)
          .set({ plan: input.plan })
          .where(
            and(
              eq(schema.location.id, location.id),
              eq(schema.location.organizationId, context.org.id),
            ),
          )
          .returning();
        if (!updated) {
          throw new ORPCError("NOT_FOUND", { message: "Location not found." });
        }
        await recordAuditThrough(tx, {
          scope: "organization",
          organizationId: context.org.id,
          actorUserId: context.session.user.id,
          action: "plan.changed",
          targetType: "location",
          targetId: location.id,
          metadata: { previous: location.plan, plan: input.plan },
        });
        return updated;
      });
    }),

  /** DIAN documents issued per Location in a Bogota month (default the current one); zero when none. */
  documentCounts: ownerProcedure
    .input(
      z.object({
        locationId: z.string().min(1).optional(),
        month: z.string().regex(MONTH_PATTERN).optional(),
      }),
    )
    .handler(async ({ context, input }) => {
      const month = input.month ?? businessDayOf(context.clock.now()).slice(0, 7);
      const ids = input.locationId
        ? [(await assertLocationAccess(context, input.locationId)).id]
        : await accessibleLocationIds(context);
      if (ids.length === 0) {
        return [];
      }
      const locations = await context.db
        .select({ id: schema.location.id })
        .from(schema.location)
        .where(
          and(eq(schema.location.organizationId, context.org.id), inArray(schema.location.id, ids)),
        )
        .orderBy(asc(schema.location.name), asc(schema.location.id));
      const counters = await context.db
        .select()
        .from(schema.dianDocumentCounter)
        .where(
          and(
            eq(schema.dianDocumentCounter.organizationId, context.org.id),
            eq(schema.dianDocumentCounter.month, month),
            inArray(schema.dianDocumentCounter.locationId, ids),
          ),
        );
      const countOf = new Map(counters.map((row) => [row.locationId, row.count]));
      return locations.map((row) => {
        const count = countOf.get(row.id) ?? 0;
        return { locationId: row.id, month, count, overFairUse: exceedsFairUse(count) };
      });
    }),
};
