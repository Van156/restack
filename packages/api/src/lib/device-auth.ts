import { hashSecret } from "@base-template/auth/staff-credentials";
import * as schema from "@base-template/db/schema";
import { and, eq } from "drizzle-orm";

import type { Clock } from "../context";
import type { DbExecutor } from "./executor";

/** What a Paired device token stands for: one Location and the Stations it may serve. */
export type AuthenticatedDevice = {
  deviceId: string;
  organizationId: string;
  locationId: string;
  stationIds: string[];
};

/**
 * Resolves a device token to its Location and Stations; `null` when unknown or revoked. Records
 * `lastSeenAt`. Kitchen procedures must restrict Ticket access to `stationIds`.
 */
export async function authenticateDevice(
  db: DbExecutor,
  clock: Clock,
  token: string,
): Promise<AuthenticatedDevice | null> {
  const [device] = await db
    .select()
    .from(schema.pairedDevice)
    .where(
      and(
        eq(schema.pairedDevice.tokenHash, hashSecret(token)),
        eq(schema.pairedDevice.status, "active"),
      ),
    );
  if (!device) {
    return null;
  }
  await db
    .update(schema.pairedDevice)
    .set({ lastSeenAt: clock.now() })
    .where(eq(schema.pairedDevice.id, device.id));
  const stations = await db
    .select({ stationId: schema.pairedDeviceStation.stationId })
    .from(schema.pairedDeviceStation)
    .where(eq(schema.pairedDeviceStation.deviceId, device.id));
  return {
    deviceId: device.id,
    organizationId: device.organizationId,
    locationId: device.locationId,
    stationIds: stations.map((row) => row.stationId).sort(),
  };
}

const DEVICE_SCHEME = "Device ";

/**
 * Resolves the `Authorization: Device <token>` header; `null` when absent, malformed or unknown.
 * See docs/architecture/restaurant.md#paired-devices.
 */
export async function deviceFromHeaders(
  db: DbExecutor,
  clock: Clock,
  headers: Headers,
): Promise<AuthenticatedDevice | null> {
  const value = headers.get("authorization");
  if (!value?.startsWith(DEVICE_SCHEME)) {
    return null;
  }
  const token = value.slice(DEVICE_SCHEME.length).trim();
  return token ? authenticateDevice(db, clock, token) : null;
}
