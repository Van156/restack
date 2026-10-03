import * as schema from "@base-template/db/schema";
import { BUYER_DOCUMENT_TYPES } from "@base-template/db/schema/restaurant-billing";
import { and, asc, eq, ilike, or } from "drizzle-orm";
import { z } from "zod";

import { orgProcedure, requirePermission } from "../../index";
import { assertLocationAccess } from "../../lib/location-scope";
import { resolveChargingMemberId } from "./billing-shared";

const SEARCH_LIMIT_DEFAULT = 10;

/** Escapes LIKE wildcards so a search term matches literally. */
function likeLiteral(term: string): string {
  return term.replace(/[\\%_]/g, (char) => `\\${char}`);
}

export const billBuyersRouter = {
  /** Searches the buyer directory by document number prefix or name. Scoped to the organization. */
  searchBuyers: orgProcedure
    .use(requirePermission({ billing: ["charge"] }))
    .input(
      z.object({
        locationId: z.string().min(1),
        query: z.string().trim().min(2).max(100),
        limit: z.number().int().min(1).max(50).default(SEARCH_LIMIT_DEFAULT),
      }),
    )
    .handler(async ({ context, input }) => {
      const location = await assertLocationAccess(context, input.locationId);
      await resolveChargingMemberId(context, location, undefined);
      const term = likeLiteral(input.query);
      return context.db
        .select()
        .from(schema.buyer)
        .where(
          and(
            eq(schema.buyer.organizationId, context.org.id),
            or(
              ilike(schema.buyer.documentNumber, `${term}%`),
              ilike(schema.buyer.name, `%${term}%`),
            ),
          ),
        )
        .orderBy(asc(schema.buyer.name))
        .limit(input.limit);
    }),

  /**
   * Saves a buyer for factura electrónica. Personal data is stored only with the buyer's consent
   * (Ley 1581); saving the same document again updates the entry.
   */
  saveBuyer: orgProcedure
    .use(requirePermission({ billing: ["charge"] }))
    .input(
      z.object({
        locationId: z.string().min(1),
        documentType: z.enum(BUYER_DOCUMENT_TYPES),
        documentNumber: z.string().trim().min(1).max(30),
        name: z.string().trim().min(1).max(200),
        email: z.email().optional(),
        consent: z.literal(true),
      }),
    )
    .handler(async ({ context, input }) => {
      const location = await assertLocationAccess(context, input.locationId);
      const memberId = await resolveChargingMemberId(context, location, undefined);
      const now = context.clock.now();
      const [saved] = await context.db
        .insert(schema.buyer)
        .values({
          organizationId: context.org.id,
          documentType: input.documentType,
          documentNumber: input.documentNumber,
          name: input.name,
          email: input.email ?? null,
          consent: true,
          consentAt: now,
          createdByMemberId: memberId,
        })
        .onConflictDoUpdate({
          target: [
            schema.buyer.organizationId,
            schema.buyer.documentType,
            schema.buyer.documentNumber,
          ],
          set: { name: input.name, email: input.email ?? null, consentAt: now },
        })
        .returning();
      return saved!;
    }),
};
