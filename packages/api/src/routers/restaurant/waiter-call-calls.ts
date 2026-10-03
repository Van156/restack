import * as schema from "@base-template/db/schema";
import { ORPCError } from "@orpc/server";
import { and, asc, eq, inArray, ne } from "drizzle-orm";
import { z } from "zod";

import { orgProcedure, requirePermission } from "../../index";
import { recordStaffSeen } from "../../lib/location-presence";
import { assertLocationAccess } from "../../lib/location-scope";
import { WAITER_CALL_COOLDOWN_MS } from "../../lib/waiter-call-guest";
import { actingTokenInput, resolveActingMemberId } from "./orders-shared";
import type { OrderContext } from "./orders-shared";

const callInput = z.object({ callId: z.string().min(1), actingToken: actingTokenInput });

async function loadCallInScope(context: OrderContext, callId: string) {
  const [row] = await context.db
    .select()
    .from(schema.waiterCall)
    .where(
      and(eq(schema.waiterCall.id, callId), eq(schema.waiterCall.organizationId, context.org.id)),
    );
  if (!row) {
    throw new ORPCError("NOT_FOUND", { message: "Waiter call not found." });
  }
  await assertLocationAccess(context, row.locationId);
  return row;
}

async function reload(context: OrderContext, callId: string) {
  const [row] = await context.db
    .select()
    .from(schema.waiterCall)
    .where(eq(schema.waiterCall.id, callId));
  return row!;
}

export const waiterCallCallsRouter = {
  /**
   * Calls still waiting for a Waiter (open or on the way) at a Location, oldest first. The
   * Waiter's screen polls this, which also marks the Location online for the guests.
   */
  list: orgProcedure
    .use(requirePermission({ order: ["take"] }))
    .input(z.object({ locationId: z.string().min(1) }))
    .handler(async ({ context, input }) => {
      await assertLocationAccess(context, input.locationId);
      await recordStaffSeen(context.db, context.clock, {
        organizationId: context.org.id,
        locationId: input.locationId,
        memberId: context.member.id,
      });
      return context.db
        .select({
          id: schema.waiterCall.id,
          tableSessionId: schema.waiterCall.tableSessionId,
          tableId: schema.tableSession.tableId,
          tableName: schema.diningTable.name,
          reason: schema.waiterCall.reason,
          status: schema.waiterCall.status,
          createdAt: schema.waiterCall.createdAt,
          acknowledgedAt: schema.waiterCall.acknowledgedAt,
          acknowledgedByMemberId: schema.waiterCall.acknowledgedByMemberId,
        })
        .from(schema.waiterCall)
        .innerJoin(
          schema.tableSession,
          eq(schema.tableSession.id, schema.waiterCall.tableSessionId),
        )
        .innerJoin(schema.diningTable, eq(schema.diningTable.id, schema.tableSession.tableId))
        .where(
          and(
            eq(schema.waiterCall.locationId, input.locationId),
            eq(schema.waiterCall.organizationId, context.org.id),
            inArray(schema.waiterCall.status, ["open", "on_the_way"]),
          ),
        )
        .orderBy(asc(schema.waiterCall.createdAt));
    }),

  /** "Voy": the Waiter is on the way. Answering a call already on the way changes nothing. */
  acknowledge: orgProcedure
    .use(requirePermission({ order: ["take"] }))
    .input(callInput)
    .handler(async ({ context, input }) => {
      const found = await loadCallInScope(context, input.callId);
      const memberId = await resolveActingMemberId(context, found.locationId, input.actingToken);
      const [answered] = await context.db
        .update(schema.waiterCall)
        .set({
          status: "on_the_way",
          acknowledgedAt: context.clock.now(),
          acknowledgedByMemberId: memberId,
        })
        .where(and(eq(schema.waiterCall.id, found.id), eq(schema.waiterCall.status, "open")))
        .returning();
      if (answered) {
        return answered;
      }
      const current = await reload(context, found.id);
      if (current.status === "attended") {
        throw new ORPCError("CONFLICT", { message: "This call was already attended." });
      }
      return current;
    }),

  /** "Atendido": closes the call and starts the guest's cooldown. Repeating it changes nothing. */
  resolve: orgProcedure
    .use(requirePermission({ order: ["take"] }))
    .input(callInput)
    .handler(async ({ context, input }) => {
      const found = await loadCallInScope(context, input.callId);
      const memberId = await resolveActingMemberId(context, found.locationId, input.actingToken);
      const now = context.clock.now();
      const [done] = await context.db
        .update(schema.waiterCall)
        .set({
          status: "attended",
          resolvedAt: now,
          resolvedByMemberId: memberId,
          cooldownUntil: new Date(now.getTime() + WAITER_CALL_COOLDOWN_MS),
        })
        .where(and(eq(schema.waiterCall.id, found.id), ne(schema.waiterCall.status, "attended")))
        .returning();
      return done ?? (await reload(context, found.id));
    }),
};
