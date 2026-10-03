import * as schema from "@base-template/db/schema";
import { ORPCError } from "@orpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { orgProcedure, requirePermission } from "../../index";
import { ensureBill, loadBillView } from "../../lib/bill";
import { loadChargeableSession, resolveChargingMemberId } from "./billing-shared";
import { actingTokenInput } from "./orders-shared";

const sessionInput = z.object({
  tableSessionId: z.string().min(1),
  actingToken: actingTokenInput,
});

/** Largest tip accepted, in COP; well below the integer column limit. */
const MAX_TIP = 100_000_000;

export const billBillRouter = {
  /** The Bill of a Table session: priced lines, tax, tip, payments and the balance still due. */
  getBill: orgProcedure
    .input(z.object({ tableSessionId: z.string().min(1) }))
    .handler(async ({ context, input }) => {
      const canView =
        (await context.authorization.hasOrgPermission(context.headers, { order: ["take"] })) ||
        (await context.authorization.hasOrgPermission(context.headers, { billing: ["charge"] }));
      if (!canView) {
        throw new ORPCError("FORBIDDEN", { message: "Missing required organization permission." });
      }
      const { session, location } = await loadChargeableSession(context, input.tableSessionId);
      return loadBillView(context.db, session, location.suggestedTipPercent);
    }),

  /**
   * Sets or changes the tip, also after the Bill settled (the lines and totals never change, only
   * the tip). Tips are voluntary: any non-negative whole-peso amount.
   */
  setTip: orgProcedure
    .use(requirePermission({ billing: ["charge"] }))
    .input(sessionInput.extend({ amount: z.number().int().min(0).max(MAX_TIP) }))
    .handler(async ({ context, input }) => {
      const { session, location } = await loadChargeableSession(context, input.tableSessionId);
      const memberId = await resolveChargingMemberId(context, location, input.actingToken);
      await ensureBill(context.db, session);
      await context.db
        .update(schema.bill)
        .set({
          tipAmount: input.amount,
          tipUpdatedByMemberId: memberId,
          tipUpdatedAt: context.clock.now(),
        })
        .where(eq(schema.bill.tableSessionId, session.id));
      return loadBillView(context.db, session, location.suggestedTipPercent);
    }),

  /** Removes the tip. Never needs an Override: a customer may always refuse it. */
  removeTip: orgProcedure
    .use(requirePermission({ billing: ["charge"] }))
    .input(sessionInput)
    .handler(async ({ context, input }) => {
      const { session, location } = await loadChargeableSession(context, input.tableSessionId);
      const memberId = await resolveChargingMemberId(context, location, input.actingToken);
      await ensureBill(context.db, session);
      await context.db
        .update(schema.bill)
        .set({ tipAmount: 0, tipUpdatedByMemberId: memberId, tipUpdatedAt: context.clock.now() })
        .where(eq(schema.bill.tableSessionId, session.id));
      return loadBillView(context.db, session, location.suggestedTipPercent);
    }),
};
