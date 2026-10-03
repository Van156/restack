import { parseStoredPin } from "@base-template/auth/staff-credentials";
import type { Database } from "@base-template/db";
import * as schema from "@base-template/db/schema";
import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";

import { orgProcedure, requirePermission } from "../../index";
import type { DbExecutor } from "../../lib/executor";
import { assertLocationAccess } from "../../lib/location-scope";
import {
  OFFLINE_MATERIAL_TTL_MS,
  OFFLINE_PIN_KDF,
  deriveOfflineKey,
  sealAad,
  sealOfflineKey,
} from "../../lib/offline-actor";
import { loadLocationRoster } from "./staff-roster";

/** Kills these members' offline material: records signed with the old epoch are refused. */
export async function rotateOfflineEpochs(
  db: DbExecutor,
  organizationId: string,
  memberIds: string[],
): Promise<void> {
  if (memberIds.length === 0) {
    return;
  }
  await db
    .update(schema.staffPin)
    .set({ offlineEpoch: sql`${schema.staffPin.offlineEpoch} + 1` })
    .where(
      and(
        eq(schema.staffPin.organizationId, organizationId),
        inArray(schema.staffPin.memberId, memberIds),
      ),
    );
}

/** Rotates the epochs of everyone who can work at a Location (a device there was revoked). */
export async function rotateLocationOfflineEpochs(
  db: Database,
  organizationId: string,
  locationId: string,
): Promise<void> {
  const roster = await loadLocationRoster(db, organizationId, locationId);
  await rotateOfflineEpochs(
    db,
    organizationId,
    roster.map((row) => row.memberId),
  );
}

export const offlineCredentialsProcedure = orgProcedure
  .use(requirePermission({ order: ["take"] }))
  .input(z.object({ locationId: z.string().min(1) }))
  .handler(async ({ context, input }) => {
    await assertLocationAccess(context, input.locationId);
    const roster = await loadLocationRoster(context.db, context.org.id, input.locationId);
    const pins = await context.db
      .select()
      .from(schema.staffPin)
      .where(
        and(
          eq(schema.staffPin.organizationId, context.org.id),
          inArray(
            schema.staffPin.memberId,
            roster.map((row) => row.memberId),
          ),
        ),
      );
    const pinOf = new Map(pins.map((row) => [row.memberId, row]));
    const expiresAt = new Date(context.clock.now().getTime() + OFFLINE_MATERIAL_TTL_MS);

    const members = roster.flatMap((member) => {
      const stored = pinOf.get(member.memberId);
      const parsed = stored ? parseStoredPin(stored.pinHash) : null;
      if (!stored || !parsed) {
        return [];
      }
      const scope = {
        organizationId: context.org.id,
        locationId: input.locationId,
        memberId: member.memberId,
        epoch: stored.offlineEpoch,
      };
      const offlineKey = deriveOfflineKey(context.actingTokenSecret, {
        ...scope,
        binding: context.member.id,
      });
      return [
        {
          memberId: member.memberId,
          name: member.name,
          role: member.role,
          salt: parsed.saltHex,
          params: OFFLINE_PIN_KDF,
          sealedKey: sealOfflineKey(parsed.key, offlineKey, sealAad(scope)),
          epoch: stored.offlineEpoch,
          expiresAt,
        },
      ];
    });
    return { members };
  });
