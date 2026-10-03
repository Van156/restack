import { hasOwnerRole } from "@base-template/auth/owner-role";
import * as schema from "@base-template/db/schema";
import { parseNit } from "@base-template/db/lib/nit";
import { ORPCError } from "@orpc/server";
import { and, asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { orgProcedure, requirePermission } from "../../index";
import { accessibleLocationIds, assertLocationAccess } from "../../lib/location-scope";

/** Length of the Completo trial every new Location starts with. */
export const LOCATION_TRIAL_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

/** The legal ceiling for a suggested tip is 10 percent. */
const tipPercent = z.number().int().min(0).max(10);

/** Normalizes a typed NIT to its canonical form and checks its DV. */
const nitField = z
  .string()
  .trim()
  .transform((raw, ctx) => {
    const parsed = parseNit(raw);
    if (!parsed.ok) {
      ctx.addIssue({
        code: "custom",
        message: parsed.reason === "check_digit" ? "Invalid NIT check digit." : "Invalid NIT.",
      });
      return z.NEVER;
    }
    return parsed.value;
  });

const createInput = z.object({
  name: z.string().trim().min(1).max(120),
  address: z.string().trim().max(240).optional(),
  nit: nitField.optional(),
  isFranchise: z.boolean().optional(),
  waitersCanCharge: z.boolean().optional(),
  suggestedTipPercent: tipPercent.optional(),
});

const updateInput = z.object({
  locationId: z.string().min(1),
  name: z.string().trim().min(1).max(120).optional(),
  address: z.string().trim().max(240).nullable().optional(),
  nit: nitField.nullable().optional(),
  isFranchise: z.boolean().optional(),
  waitersCanCharge: z.boolean().optional(),
  suggestedTipPercent: tipPercent.optional(),
  active: z.boolean().optional(),
});

export const locationsRouter = {
  /** Locations the caller may act in: all for the Owner, assigned ones for everyone else. */
  list: orgProcedure.handler(async ({ context }) => {
    const ids = await accessibleLocationIds(context);
    if (ids.length === 0) {
      return [];
    }
    return context.db
      .select()
      .from(schema.location)
      .where(
        and(eq(schema.location.organizationId, context.org.id), inArray(schema.location.id, ids)),
      )
      .orderBy(asc(schema.location.name), asc(schema.location.id));
  }),

  /** The Owner adds Locations; a new one starts on a Completo trial counted from the injected clock. */
  create: orgProcedure
    .use(requirePermission({ setup: ["manage"] }))
    .input(createInput)
    .handler(async ({ context, input }) => {
      if (!hasOwnerRole(context.member.role)) {
        throw new ORPCError("FORBIDDEN", { message: "Only the Owner can add a Location." });
      }
      const trialEndsAt = new Date(context.clock.now().getTime() + LOCATION_TRIAL_DAYS * DAY_MS);
      const [created] = await context.db
        .insert(schema.location)
        .values({
          organizationId: context.org.id,
          name: input.name,
          address: input.address,
          nit: input.nit,
          isFranchise: input.isFranchise,
          waitersCanCharge: input.waitersCanCharge,
          suggestedTipPercent: input.suggestedTipPercent,
          plan: "completo",
          trialEndsAt,
        })
        .returning();
      if (!created) {
        throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Location was not created." });
      }
      await context.auditLogger.record({
        scope: "organization",
        organizationId: context.org.id,
        actorUserId: context.session.user.id,
        action: "location.created",
        targetType: "location",
        targetId: created.id,
        metadata: { name: created.name },
      });
      return created;
    }),

  /** Edits the operational settings of a Location. Plan and DIAN fields have their own procedures. */
  update: orgProcedure
    .use(requirePermission({ setup: ["manage"] }))
    .input(updateInput)
    .handler(async ({ context, input }) => {
      await assertLocationAccess(context, input.locationId);
      const { locationId, ...changes } = input;
      const definedChanges = Object.fromEntries(
        Object.entries(changes).filter(([, value]) => value !== undefined),
      );
      if (Object.keys(definedChanges).length === 0) {
        throw new ORPCError("BAD_REQUEST", { message: "Nothing to update." });
      }
      const [updated] = await context.db
        .update(schema.location)
        .set(definedChanges)
        .where(
          and(
            eq(schema.location.id, locationId),
            eq(schema.location.organizationId, context.org.id),
          ),
        )
        .returning();
      if (!updated) {
        throw new ORPCError("NOT_FOUND", { message: "Location not found." });
      }
      await context.auditLogger.record({
        scope: "organization",
        organizationId: context.org.id,
        actorUserId: context.session.user.id,
        action: "location.updated",
        targetType: "location",
        targetId: updated.id,
        metadata: { changedFields: Object.keys(definedChanges) },
      });
      return updated;
    }),
};
