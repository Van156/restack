import * as schema from "@base-template/db/schema";
import { and, eq } from "drizzle-orm";

import type { OrderContext } from "./orders-shared";

type Stored = { writtenAt: Date | null; writeKey: string | null };

/** True when a write at (`at`, `key`) beats the stored one: later device time, then the greater key. */
export function beatsStored(incoming: { at: Date; key: string }, stored: Stored): boolean {
  if (!stored.writtenAt) {
    return true;
  }
  if (incoming.at.getTime() !== stored.writtenAt.getTime()) {
    return incoming.at.getTime() > stored.writtenAt.getTime();
  }
  return incoming.key > (stored.writeKey ?? "");
}

/** True when this sync key belongs to a last-write-wins write that lost to a newer one. */
export async function wasSuperseded(
  context: Pick<OrderContext, "db" | "org">,
  key: string,
): Promise<boolean> {
  const [row] = await context.db
    .select({ id: schema.syncSupersededWrite.id })
    .from(schema.syncSupersededWrite)
    .where(
      and(
        eq(schema.syncSupersededWrite.organizationId, context.org.id),
        eq(schema.syncSupersededWrite.idempotencyKey, key),
      ),
    );
  return Boolean(row);
}

/**
 * Remembers the key of a write that lost (or was overtaken), so replaying it reports
 * `already_applied`. Callers hold the row lock of the entity, so this never races itself.
 */
export async function markSuperseded(
  context: Pick<OrderContext, "db" | "org">,
  key: string | null,
): Promise<void> {
  if (!key) {
    return;
  }
  await context.db
    .insert(schema.syncSupersededWrite)
    .values({ organizationId: context.org.id, idempotencyKey: key })
    .onConflictDoNothing();
}
