import * as schema from "@base-template/db/schema";
import { ORPCError } from "@orpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { assertLocationAccess } from "../../lib/location-scope";
import { loadAreaInScope } from "./areas";
import { idempotencyKey } from "./orders-shared";
import type { OrderContext } from "./orders-shared";
import { definedFields, orConflict } from "./setup-helpers";

export const tableMetadataPayload = z
  .object({
    tableId: z.string().min(1),
    name: z.string().trim().min(1).max(80).optional(),
    seats: z.number().int().min(1).max(100).optional(),
    areaId: z.string().min(1).optional(),
  })
  .refine((payload) => [payload.name, payload.seats, payload.areaId].some((v) => v !== undefined), {
    message: "Nothing to update.",
  });

export type TableMetadataOutcome = { status: "applied" | "already_applied"; note?: "superseded" };

/** True when a write at (`at`, `key`) beats the stored one: later device time, then the greater key. */
function beatsStored(
  incoming: { at: Date; key: string },
  stored: { writtenAt: Date | null; writeKey: string | null },
): boolean {
  if (!stored.writtenAt) {
    return true;
  }
  if (incoming.at.getTime() !== stored.writtenAt.getTime()) {
    return incoming.at.getTime() > stored.writtenAt.getTime();
  }
  return incoming.key > (stored.writeKey ?? "");
}

/**
 * Applies a synced Table metadata write with last-write-wins by device time; a tie goes to the
 * greater sync key, so the result does not depend on arrival order and a replay changes nothing.
 * The caller clamps `deviceAt` to the server clock. See docs/architecture/restaurant.md#sync.
 */
export async function applyTableMetadata(
  context: OrderContext,
  record: { idempotencyKey: z.infer<typeof idempotencyKey>; deviceAt: Date },
  payload: z.infer<typeof tableMetadataPayload>,
): Promise<TableMetadataOutcome & { tableId: string }> {
  const [table] = await context.db
    .select()
    .from(schema.diningTable)
    .where(
      and(
        eq(schema.diningTable.id, payload.tableId),
        eq(schema.diningTable.organizationId, context.org.id),
      ),
    )
    .for("update");
  if (!table) {
    throw new ORPCError("NOT_FOUND", { message: "Table not found." });
  }
  await assertLocationAccess(context, table.locationId);
  if (table.metadataWriteKey === record.idempotencyKey) {
    return { status: "already_applied", tableId: table.id };
  }
  const incoming = { at: record.deviceAt, key: record.idempotencyKey };
  if (
    !beatsStored(incoming, { writtenAt: table.metadataWrittenAt, writeKey: table.metadataWriteKey })
  ) {
    return { status: "applied", note: "superseded", tableId: table.id };
  }
  if (payload.areaId) {
    const area = await loadAreaInScope(context, payload.areaId);
    if (area.locationId !== table.locationId) {
      throw new ORPCError("BAD_REQUEST", {
        message: "A Table can only move to an Area of its own Location.",
      });
    }
  }
  await orConflict("A Table with this name already exists in this Location.", () =>
    context.db
      .update(schema.diningTable)
      .set({
        ...definedFields({ name: payload.name, seats: payload.seats, areaId: payload.areaId }),
        metadataWrittenAt: record.deviceAt,
        metadataWriteKey: record.idempotencyKey,
      })
      .where(eq(schema.diningTable.id, table.id)),
  );
  return { status: "applied", tableId: table.id };
}
