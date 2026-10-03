import * as schema from "@base-template/db/schema";
import {
  DIAN_HABILITACION_STATUSES,
  DIAN_PROVIDERS,
} from "@base-template/db/schema/restaurant-dian";
import { ORPCError } from "@orpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import type { Context } from "../../context";
import { orgProcedure, requirePermission } from "../../index";
import { recordAuditThrough } from "../../lib/audit-in-transaction";
import { planAllowsDian } from "../../lib/invoicing/plan-gate";
import { InvoicingNotConfiguredError, InvoicingTransientError } from "../../lib/invoicing/types";
import type { DbExecutor } from "../../lib/executor";
import { assertLocationAccess } from "../../lib/location-scope";

const locationInput = z.object({ locationId: z.string().min(1) });

const connectInput = locationInput.extend({
  provider: z.enum(DIAN_PROVIDERS),
  companyReference: z.string().trim().min(1).max(120),
  numberingPrefix: z.string().trim().max(20).nullable().optional(),
  habilitacion: z.enum(DIAN_HABILITACION_STATUSES),
});

/** Anyone who may charge or connect DIAN can read its state. */
export async function assertCanViewDian(
  context: Pick<Context, "authorization" | "headers">,
): Promise<void> {
  const can =
    (await context.authorization.hasOrgPermission(context.headers, { billing: ["charge"] })) ||
    (await context.authorization.hasOrgPermission(context.headers, { dian: ["connect"] }));
  if (!can) {
    throw new ORPCError("FORBIDDEN", { message: "Missing required organization permission." });
  }
}

export async function findConnection(db: DbExecutor, locationId: string) {
  const [row] = await db
    .select()
    .from(schema.dianConnection)
    .where(eq(schema.dianConnection.locationId, locationId));
  return row;
}

export const dianSetupRouter = {
  /** The Owner turns DIAN on or off for a Location; the decision and its author are audited. */
  setChoice: orgProcedure
    .use(requirePermission({ dian: ["choose"] }))
    .input(locationInput.extend({ enabled: z.boolean() }))
    .handler(async ({ context, input }) => {
      const location = await assertLocationAccess(context, input.locationId);
      return context.db.transaction(async (tx) => {
        const now = context.clock.now();
        const [updated] = await tx
          .update(schema.location)
          .set({
            dianEnabled: input.enabled,
            dianChoiceByUserId: context.session.user.id,
            dianChoiceAt: now,
          })
          .where(
            and(
              eq(schema.location.id, location.id),
              eq(schema.location.organizationId, context.org.id),
            ),
          )
          .returning();
        if (location.dianChoiceAt === null || location.dianEnabled !== input.enabled) {
          await recordAuditThrough(tx, {
            scope: "organization",
            organizationId: context.org.id,
            actorUserId: context.session.user.id,
            action: "dian.choice_changed",
            targetType: "location",
            targetId: location.id,
            metadata: { enabled: input.enabled, previous: location.dianEnabled },
          });
        }
        return updated!;
      });
    }),

  /** Sets the provider company, numbering and habilitación state of a Location; audited. */
  connect: orgProcedure
    .use(requirePermission({ dian: ["connect"] }))
    .input(connectInput)
    .handler(async ({ context, input }) => {
      const location = await assertLocationAccess(context, input.locationId);
      if (!location.nit) {
        throw new ORPCError("PRECONDITION_FAILED", {
          message: "Set the Location NIT before connecting DIAN.",
        });
      }
      return context.db.transaction(async (tx) => {
        const values = {
          provider: input.provider,
          companyReference: input.companyReference,
          numberingPrefix: input.numberingPrefix ?? null,
          habilitacion: input.habilitacion,
          connectedByUserId: context.session.user.id,
          connectedAt: context.clock.now(),
        };
        const [connection] = await tx
          .insert(schema.dianConnection)
          .values({ ...values, organizationId: context.org.id, locationId: location.id })
          .onConflictDoUpdate({ target: schema.dianConnection.locationId, set: values })
          .returning();
        await recordAuditThrough(tx, {
          scope: "organization",
          organizationId: context.org.id,
          actorUserId: context.session.user.id,
          action: "dian.connected",
          targetType: "location",
          targetId: location.id,
          metadata: {
            provider: input.provider,
            companyReference: input.companyReference,
            numberingPrefix: values.numberingPrefix,
            habilitacion: input.habilitacion,
          },
        });
        return connection!;
      });
    }),

  /** Asks the provider for the company's habilitación and stores it; an unchanged state writes nothing. */
  refreshHabilitacion: orgProcedure
    .use(requirePermission({ dian: ["connect"] }))
    .input(locationInput)
    .handler(async ({ context, input }) => {
      const location = await assertLocationAccess(context, input.locationId);
      const connection = await findConnection(context.db, location.id);
      if (!connection) {
        throw new ORPCError("PRECONDITION_FAILED", { message: "Connect a provider first." });
      }
      if (!context.invoicing) {
        throw new ORPCError("SERVICE_UNAVAILABLE", {
          message: "No invoicing provider is configured.",
        });
      }
      let habilitacion;
      try {
        habilitacion = await context.invoicing.habilitacionStatus(connection);
      } catch (error) {
        if (
          error instanceof InvoicingNotConfiguredError ||
          error instanceof InvoicingTransientError
        ) {
          throw new ORPCError("SERVICE_UNAVAILABLE", { message: error.message });
        }
        throw error;
      }
      if (habilitacion === connection.habilitacion) {
        return connection;
      }
      return context.db.transaction(async (tx) => {
        const [updated] = await tx
          .update(schema.dianConnection)
          .set({ habilitacion })
          .where(eq(schema.dianConnection.id, connection.id))
          .returning();
        await recordAuditThrough(tx, {
          scope: "organization",
          organizationId: context.org.id,
          actorUserId: context.session.user.id,
          action: "dian.connected",
          targetType: "location",
          targetId: location.id,
          metadata: { habilitacion, previous: connection.habilitacion, refreshed: true },
        });
        return updated!;
      });
    }),

  /** The DIAN state of a Location: choice, plan gate, connection and habilitación. */
  status: orgProcedure.input(locationInput).handler(async ({ context, input }) => {
    await assertCanViewDian(context);
    const location = await assertLocationAccess(context, input.locationId);
    const connection = (await findConnection(context.db, location.id)) ?? null;
    return {
      locationId: location.id,
      enabled: location.dianEnabled,
      choiceAt: location.dianChoiceAt,
      plan: location.plan,
      trialEndsAt: location.trialEndsAt,
      planAllowsDian: planAllowsDian(location, context.clock.now()),
      habilitacion: connection?.habilitacion ?? "not_started",
      connection,
    };
  }),
};
