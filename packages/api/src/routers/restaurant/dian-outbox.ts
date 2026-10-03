import * as schema from "@base-template/db/schema";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";

import { orgProcedure, requirePermission } from "../../index";
import { assertLocationAccess } from "../../lib/location-scope";
import { assertCanViewDian } from "./dian-setup";

const locationInput = z.object({ locationId: z.string().min(1) });

export const dianOutboxRouter = {
  /** Documents waiting to be transmitted, oldest deadline first, with their retry state. */
  listOutbox: orgProcedure.input(locationInput).handler(async ({ context, input }) => {
    await assertCanViewDian(context);
    const location = await assertLocationAccess(context, input.locationId);
    const rows = await context.db
      .select({ outbox: schema.dianOutbox, document: schema.dianDocument })
      .from(schema.dianOutbox)
      .innerJoin(schema.dianDocument, eq(schema.dianDocument.id, schema.dianOutbox.documentId))
      .where(
        and(eq(schema.dianOutbox.locationId, location.id), isNull(schema.dianOutbox.completedAt)),
      )
      .orderBy(asc(schema.dianOutbox.transmitBy));
    return rows.map(({ outbox, document }) => ({
      documentId: document.id,
      kind: document.kind,
      saleTime: document.saleTime,
      contingency: document.contingency,
      attempts: outbox.attempts,
      nextAttemptAt: outbox.nextAttemptAt,
      transmitBy: outbox.transmitBy,
      overdue: outbox.overdueAt !== null,
      lastError: outbox.lastError,
    }));
  }),

  /** The incident log of a Location: when documents could not be transmitted and what it covered. */
  listIncidents: orgProcedure.input(locationInput).handler(async ({ context, input }) => {
    await assertCanViewDian(context);
    const location = await assertLocationAccess(context, input.locationId);
    return context.db
      .select()
      .from(schema.dianIncident)
      .where(eq(schema.dianIncident.locationId, location.id))
      .orderBy(desc(schema.dianIncident.startedAt));
  }),

  /** Issued documents per month for a Location, newest month first. */
  documentCounts: orgProcedure
    .use(requirePermission({ dian: ["connect"] }))
    .input(locationInput)
    .handler(async ({ context, input }) => {
      const location = await assertLocationAccess(context, input.locationId);
      const rows = await context.db
        .select({
          month: schema.dianDocumentCounter.month,
          count: schema.dianDocumentCounter.count,
        })
        .from(schema.dianDocumentCounter)
        .where(eq(schema.dianDocumentCounter.locationId, location.id))
        .orderBy(desc(schema.dianDocumentCounter.month));
      return rows;
    }),
};
