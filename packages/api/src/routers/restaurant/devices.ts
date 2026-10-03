import {
  generatePairingCode,
  generateSecretToken,
  hashSecret,
} from "@base-template/auth/staff-credentials";
import * as schema from "@base-template/db/schema";
import { ORPCError } from "@orpc/server";
import { and, asc, eq, gt, inArray } from "drizzle-orm";
import { z } from "zod";

import { orgProcedure, publicProcedure, requirePermission } from "../../index";
import { assertLocationAccess } from "../../lib/location-scope";
import type { LocationScopeContext } from "../../lib/location-scope";

const MINUTE_MS = 60 * 1000;
/** How long a pairing code can be redeemed. */
const PAIRING_CODE_TTL_MINUTES = 15;
const name = z.string().trim().min(1).max(80);
/** Guessing limits for the public redeem: attempts per source and per code in the window. */
const SOURCE_RULE = { limit: 20, windowMs: 15 * MINUTE_MS };
const CODE_RULE = { limit: 5, windowMs: 15 * MINUTE_MS };

/** First `x-forwarded-for` entry, else `x-real-ip`; shared bucket when neither is present. */
function sourceOf(headers: Headers): string {
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip") || "unknown"
  );
}
const INVALID_CODE = "This pairing code is invalid or has expired.";

/** A device of the caller's organization, with the caller's access to its Location checked. */
async function loadDeviceInScope(context: LocationScopeContext, deviceId: string) {
  const [row] = await context.db
    .select()
    .from(schema.pairedDevice)
    .where(
      and(
        eq(schema.pairedDevice.id, deviceId),
        eq(schema.pairedDevice.organizationId, context.org.id),
      ),
    );
  if (!row) {
    throw new ORPCError("NOT_FOUND", { message: "Device not found." });
  }
  await assertLocationAccess(context, row.locationId);
  return row;
}

export const devicesRouter = {
  /** Starts pairing a kitchen device; returns a one-time code, stored only as a hash. */
  createPairing: orgProcedure
    .use(requirePermission({ setup: ["manage"] }))
    .input(
      z.object({
        locationId: z.string().min(1),
        name,
        stationIds: z.array(z.string().min(1)).min(1).max(50),
      }),
    )
    .handler(async ({ context, input }) => {
      await assertLocationAccess(context, input.locationId);
      const stationIds = [...new Set(input.stationIds)];
      const stations = await context.db
        .select({ id: schema.station.id })
        .from(schema.station)
        .where(
          and(
            inArray(schema.station.id, stationIds),
            eq(schema.station.locationId, input.locationId),
            eq(schema.station.organizationId, context.org.id),
          ),
        );
      if (stations.length !== stationIds.length) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Every Station must belong to the chosen Location.",
        });
      }

      const code = generatePairingCode();
      const expiresAt = new Date(
        context.clock.now().getTime() + PAIRING_CODE_TTL_MINUTES * MINUTE_MS,
      );
      const deviceId = await context.db.transaction(async (tx) => {
        const [device] = await tx
          .insert(schema.pairedDevice)
          .values({
            organizationId: context.org.id,
            locationId: input.locationId,
            name: input.name,
            activationCodeHash: hashSecret(code),
            activationExpiresAt: expiresAt,
            createdByUserId: context.session.user.id,
          })
          .returning({ id: schema.pairedDevice.id });
        await tx
          .insert(schema.pairedDeviceStation)
          .values(stationIds.map((stationId) => ({ deviceId: device!.id, stationId })));
        return device!.id;
      });
      return { deviceId, code, expiresAt };
    }),

  /**
   * Public: the device redeems its one-time code (works once) for a revocable token, shown once.
   * Rate limited per source and per code.
   */
  redeem: publicProcedure
    .input(z.object({ code: z.string().trim().min(1).max(32) }))
    .handler(async ({ context, input }) => {
      const code = input.code.toUpperCase();
      const allowed =
        !context.rateLimiter ||
        (context.rateLimiter.hit(
          `device-redeem:source:${sourceOf(context.headers)}`,
          SOURCE_RULE,
        ) &&
          context.rateLimiter.hit(`device-redeem:code:${hashSecret(code)}`, CODE_RULE));
      if (!allowed) {
        throw new ORPCError("TOO_MANY_REQUESTS", {
          message: "Too many attempts. Try again later.",
        });
      }
      const now = context.clock.now();
      const token = generateSecretToken();
      const [device] = await context.db
        .update(schema.pairedDevice)
        .set({
          status: "active",
          tokenHash: hashSecret(token),
          activationCodeHash: null,
          activationExpiresAt: null,
          lastSeenAt: now,
        })
        .where(
          and(
            eq(schema.pairedDevice.activationCodeHash, hashSecret(code)),
            eq(schema.pairedDevice.status, "pending"),
            gt(schema.pairedDevice.activationExpiresAt, now),
          ),
        )
        .returning();
      if (!device) {
        throw new ORPCError("NOT_FOUND", { message: INVALID_CODE });
      }
      const stations = await context.db
        .select({ stationId: schema.pairedDeviceStation.stationId })
        .from(schema.pairedDeviceStation)
        .where(eq(schema.pairedDeviceStation.deviceId, device.id));
      // No signed-in user redeems: the Staff member who created the pairing is the audit actor.
      await context.auditLogger.record({
        scope: "organization",
        organizationId: device.organizationId,
        actorUserId: device.createdByUserId,
        action: "device.paired",
        targetType: "device",
        targetId: device.id,
        metadata: { name: device.name, locationId: device.locationId },
      });
      return {
        deviceToken: token,
        device: {
          id: device.id,
          name: device.name,
          locationId: device.locationId,
          stationIds: stations.map((row) => row.stationId).sort(),
        },
      };
    }),

  rename: orgProcedure
    .use(requirePermission({ setup: ["manage"] }))
    .input(z.object({ deviceId: z.string().min(1), name }))
    .handler(async ({ context, input }) => {
      const device = await loadDeviceInScope(context, input.deviceId);
      await context.db
        .update(schema.pairedDevice)
        .set({ name: input.name })
        .where(eq(schema.pairedDevice.id, device.id));
      return { deviceId: device.id, name: input.name };
    }),

  /** Cuts a device off at once: its token stops resolving and an unused code stops working. */
  revoke: orgProcedure
    .use(requirePermission({ setup: ["manage"] }))
    .input(z.object({ deviceId: z.string().min(1) }))
    .handler(async ({ context, input }) => {
      const device = await loadDeviceInScope(context, input.deviceId);
      if (device.status === "revoked") {
        return { deviceId: device.id, revoked: true };
      }
      await context.db
        .update(schema.pairedDevice)
        .set({
          status: "revoked",
          tokenHash: null,
          activationCodeHash: null,
          activationExpiresAt: null,
          revokedAt: context.clock.now(),
        })
        .where(eq(schema.pairedDevice.id, device.id));
      await context.auditLogger.record({
        scope: "organization",
        organizationId: context.org.id,
        actorUserId: context.session.user.id,
        action: "device.revoked",
        targetType: "device",
        targetId: device.id,
        metadata: { name: device.name, locationId: device.locationId },
      });
      return { deviceId: device.id, revoked: true };
    }),

  /** Devices of a Location with their Stations; never any secret. */
  list: orgProcedure
    .use(requirePermission({ setup: ["manage"] }))
    .input(z.object({ locationId: z.string().min(1) }))
    .handler(async ({ context, input }) => {
      await assertLocationAccess(context, input.locationId);
      const devices = await context.db
        .select({
          id: schema.pairedDevice.id,
          name: schema.pairedDevice.name,
          status: schema.pairedDevice.status,
          lastSeenAt: schema.pairedDevice.lastSeenAt,
          activationExpiresAt: schema.pairedDevice.activationExpiresAt,
          createdAt: schema.pairedDevice.createdAt,
        })
        .from(schema.pairedDevice)
        .where(
          and(
            eq(schema.pairedDevice.locationId, input.locationId),
            eq(schema.pairedDevice.organizationId, context.org.id),
          ),
        )
        .orderBy(asc(schema.pairedDevice.createdAt));
      if (devices.length === 0) {
        return [];
      }
      const links = await context.db
        .select()
        .from(schema.pairedDeviceStation)
        .where(
          inArray(
            schema.pairedDeviceStation.deviceId,
            devices.map((device) => device.id),
          ),
        );
      return devices.map((device) => ({
        ...device,
        stationIds: links
          .filter((link) => link.deviceId === device.id)
          .map((link) => link.stationId)
          .sort(),
      }));
    }),
};
