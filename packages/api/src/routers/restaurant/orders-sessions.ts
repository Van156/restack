import * as schema from "@base-template/db/schema";
import { ORPCError } from "@orpc/server";
import { and, asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { orgProcedure, requirePermission } from "../../index";
import { assertLocationAccess } from "../../lib/location-scope";
import { UNSETTLED_SESSION_STATUSES } from "../../lib/table-session";
import {
  actingTokenInput,
  assertSessionUnsettled,
  generateShortCode,
  loadSessionInScope,
  resolveActingMemberId,
} from "./orders-shared";
import type { OrderContext } from "./orders-shared";
import { orConflict } from "./setup-helpers";

const TABLE_OCCUPIED = "This Table already has an open session.";

async function loadTableInOrg(context: OrderContext, tableId: string) {
  const [table] = await context.db
    .select()
    .from(schema.diningTable)
    .where(
      and(
        eq(schema.diningTable.id, tableId),
        eq(schema.diningTable.organizationId, context.org.id),
      ),
    );
  if (!table) {
    throw new ORPCError("NOT_FOUND", { message: "Table not found." });
  }
  return table;
}

export const orderSessionsRouter = {
  /** Open sessions (open or bill requested) of a Location, for the floor plan. */
  listOpenSessions: orgProcedure
    .input(z.object({ locationId: z.string().min(1) }))
    .handler(async ({ context, input }) => {
      await assertLocationAccess(context, input.locationId);
      return context.db
        .select()
        .from(schema.tableSession)
        .where(
          and(
            eq(schema.tableSession.locationId, input.locationId),
            eq(schema.tableSession.organizationId, context.org.id),
            inArray(schema.tableSession.status, [...UNSETTLED_SESSION_STATUSES]),
          ),
        )
        .orderBy(asc(schema.tableSession.openedAt));
    }),

  /** Opens a session at a free Table. One unsettled session per Table (CONFLICT otherwise). */
  openSession: orgProcedure
    .use(requirePermission({ order: ["take"] }))
    .input(
      z.object({
        locationId: z.string().min(1),
        tableId: z.string().min(1),
        actingToken: actingTokenInput,
      }),
    )
    .handler(async ({ context, input }) => {
      await assertLocationAccess(context, input.locationId);
      const table = await loadTableInOrg(context, input.tableId);
      if (table.locationId !== input.locationId) {
        throw new ORPCError("NOT_FOUND", { message: "Table not found." });
      }
      const memberId = await resolveActingMemberId(context, input.locationId, input.actingToken);
      const [created] = await orConflict(TABLE_OCCUPIED, () =>
        context.db
          .insert(schema.tableSession)
          .values({
            organizationId: context.org.id,
            locationId: input.locationId,
            tableId: table.id,
            openedByMemberId: memberId,
            openedAt: context.clock.now(),
            shortCode: generateShortCode(),
          })
          .returning(),
      );
      return created!;
    }),

  /** Moves an unsettled session to a free Table of the same Location. */
  moveSession: orgProcedure
    .use(requirePermission({ order: ["take"] }))
    .input(z.object({ tableSessionId: z.string().min(1), tableId: z.string().min(1) }))
    .handler(async ({ context, input }) => {
      const session = await loadSessionInScope(context, input.tableSessionId);
      assertSessionUnsettled(session);
      const table = await loadTableInOrg(context, input.tableId);
      if (table.locationId !== session.locationId) {
        throw new ORPCError("BAD_REQUEST", {
          message: "A session can only move to a Table of its own Location.",
        });
      }
      if (table.id === session.tableId) {
        return session;
      }
      const [moved] = await orConflict(TABLE_OCCUPIED, () =>
        context.db
          .update(schema.tableSession)
          .set({ tableId: table.id })
          .where(eq(schema.tableSession.id, session.id))
          .returning(),
      );
      return moved!;
    }),

  /** Marks the bill as requested (the Bill itself is computed at checkout). Repeating it is a no-op. */
  requestBill: orgProcedure
    .use(requirePermission({ order: ["take"] }))
    .input(z.object({ tableSessionId: z.string().min(1) }))
    .handler(async ({ context, input }) => {
      const session = await loadSessionInScope(context, input.tableSessionId);
      assertSessionUnsettled(session);
      if (session.status === "bill_requested") {
        return session;
      }
      const [updated] = await context.db
        .update(schema.tableSession)
        .set({ status: "bill_requested" })
        .where(eq(schema.tableSession.id, session.id))
        .returning();
      return updated!;
    }),
};
