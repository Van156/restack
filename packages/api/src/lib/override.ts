import * as schema from "@base-template/db/schema";
import { auditLog } from "@base-template/db/schema/audit";
import type { OverrideAction } from "@base-template/db/schema/restaurant-staff";
import { ORPCError } from "@orpc/server";
import { and, eq, gt, isNull } from "drizzle-orm";

import type { Clock } from "../context";
import type { DbExecutor } from "./executor";

/** How long a minted Override can be presented. */
export const OVERRIDE_TTL_MINUTES = 5;

export type ConsumeOverrideInput = {
  organizationId: string;
  /** The user performing the guarded action, recorded on the `override.used` audit event. */
  actorUserId: string;
  overrideId: string;
  locationId: string;
  action: OverrideAction;
  target: string;
};

/**
 * Spends an Override for a guarded action (void of a sent line, discount, Bill reopen, Cash shift
 * close with a difference). The single `UPDATE ... WHERE` makes it atomic: it only succeeds when
 * the Override is unused, unexpired and bound to exactly this Location, action and target, so a
 * refused attempt never burns it and two concurrent callers cannot both win. Pass the caller's
 * transaction so the spend rolls back with the action it authorized. Returns the approver.
 */
export async function consumeOverride(
  deps: { db: DbExecutor; clock: Clock },
  input: ConsumeOverrideInput,
): Promise<{ approverMemberId: string }> {
  const now = deps.clock.now();
  const [spent] = await deps.db
    .update(schema.override)
    .set({ usedAt: now })
    .where(
      and(
        eq(schema.override.id, input.overrideId),
        eq(schema.override.organizationId, input.organizationId),
        eq(schema.override.locationId, input.locationId),
        eq(schema.override.action, input.action),
        eq(schema.override.target, input.target),
        isNull(schema.override.usedAt),
        gt(schema.override.expiresAt, now),
      ),
    )
    .returning();
  if (!spent) {
    throw new ORPCError("FORBIDDEN", {
      message: "This Override is invalid, expired or already used.",
    });
  }

  // Written through the caller's executor, not the audit port, so it rolls back with the spend.
  await deps.db.insert(auditLog).values({
    scope: "organization",
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    action: "override.used",
    targetType: "override",
    targetId: spent.id,
    metadata: {
      locationId: spent.locationId,
      action: spent.action,
      target: spent.target,
      approverMemberId: spent.approverMemberId,
    },
  });
  return { approverMemberId: spent.approverMemberId };
}
