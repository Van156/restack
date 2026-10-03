import * as schema from "@base-template/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { orgProcedure, requirePermission } from "../../index";
import { recordAuditThrough } from "../../lib/audit-in-transaction";
import { signTableSessionToken } from "../../lib/table-session-token";
import { assertSessionUnsettled, generateShortCode, loadSessionInScope } from "./orders-shared";
import type { OrderContext, TableSessionRow } from "./orders-shared";

const sessionInput = z.object({ tableSessionId: z.string().min(1) });

function qrOf(context: OrderContext, session: TableSessionRow) {
  const { token, expiresAt } = signTableSessionToken(
    context.actingTokenSecret,
    {
      organizationId: session.organizationId,
      locationId: session.locationId,
      tableSessionId: session.id,
      version: session.tokenVersion,
    },
    context.clock.now(),
  );
  return { token, shortCode: session.shortCode, expiresAt };
}

export const waiterCallQrRouter = {
  /** The signed token the Table session QR encodes, with the short code shown beside it. */
  qr: orgProcedure
    .use(requirePermission({ order: ["take"] }))
    .input(sessionInput)
    .handler(async ({ context, input }) => {
      const session = await loadSessionInScope(context, input.tableSessionId);
      assertSessionUnsettled(session);
      return qrOf(context, session);
    }),

  /**
   * Replaces the QR: the version and short code change, so every earlier QR stops working.
   * Audited in the same transaction as `waiter_call.qr_regenerated`.
   */
  regenerateQr: orgProcedure
    .use(requirePermission({ order: ["take"] }))
    .input(sessionInput)
    .handler(async ({ context, input }) => {
      const session = await loadSessionInScope(context, input.tableSessionId);
      assertSessionUnsettled(session);
      return context.db.transaction(async (tx) => {
        const [updated] = await tx
          .update(schema.tableSession)
          .set({
            tokenVersion: session.tokenVersion + 1,
            shortCode: generateShortCode(),
          })
          .where(eq(schema.tableSession.id, session.id))
          .returning();
        await recordAuditThrough(tx, {
          scope: "organization",
          organizationId: context.org.id,
          actorUserId: context.session.user.id,
          action: "waiter_call.qr_regenerated",
          targetType: "table_session",
          targetId: session.id,
          metadata: { version: updated!.tokenVersion },
        });
        return qrOf(context, updated!);
      });
    }),
};
