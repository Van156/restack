import type { Database } from "@base-template/db";
import * as schema from "@base-template/db/schema";
import { ORPCError } from "@orpc/server";
import { and, eq } from "drizzle-orm";

import { assertOrgPermission, publicProcedure, resolveActiveOrg } from "../../index";
import type { Context } from "../../context";
import type { AuthenticatedDevice } from "../../lib/device-auth";
import { assertLocationAccess } from "../../lib/location-scope";

/** Who is calling a kitchen procedure: a Paired device, or a Staff member of the organization. */
export type KitchenCaller =
  | { kind: "device"; organizationId: string; device: AuthenticatedDevice }
  | {
      kind: "staff";
      organizationId: string;
      member: { id: string; role: string };
    };

async function resolveCaller(context: Context): Promise<KitchenCaller> {
  if (context.device) {
    return {
      kind: "device",
      organizationId: context.device.organizationId,
      device: context.device,
    };
  }
  if (!context.session?.user) {
    throw new ORPCError("UNAUTHORIZED");
  }
  const { org, member } = await resolveActiveOrg({ ...context, session: context.session });
  await assertOrgPermission(context, { order: ["take"] });
  return { kind: "staff", organizationId: org.id, member };
}

/**
 * Kitchen procedures accept a Paired device (carried as `context.device`) or a signed-in Staff
 * member with `order:take`. Everything else rejects a device-only caller because it has no session.
 * See docs/architecture/restaurant.md#kitchen-display.
 */
export const kitchenProcedure = publicProcedure.use(async ({ context, next }) => {
  const caller = await resolveCaller(context);
  return next({ context: { caller } });
});

/** Throws unless the caller may act on this Location (and Station): its own for a device. */
export async function assertKitchenAccess(
  db: Database,
  caller: KitchenCaller,
  target: { locationId: string; stationId?: string },
): Promise<void> {
  if (caller.kind === "device") {
    const { device } = caller;
    if (
      target.locationId !== device.locationId ||
      (target.stationId !== undefined && !device.stationIds.includes(target.stationId))
    ) {
      throw new ORPCError("FORBIDDEN", {
        message: "This device cannot access that Station.",
      });
    }
    return;
  }
  await assertLocationAccess(
    { db, org: { id: caller.organizationId }, member: caller.member },
    target.locationId,
  );
}

/** A Station of the caller's organization at the Location; NOT_FOUND otherwise. */
export async function loadStationAt(
  db: Database,
  organizationId: string,
  locationId: string,
  stationId: string,
) {
  const [station] = await db
    .select()
    .from(schema.station)
    .where(
      and(
        eq(schema.station.id, stationId),
        eq(schema.station.organizationId, organizationId),
        eq(schema.station.locationId, locationId),
      ),
    );
  if (!station) {
    throw new ORPCError("NOT_FOUND", { message: "Station not found." });
  }
  return station;
}
