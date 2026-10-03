import * as schema from "@base-template/db/schema";
import type { OverrideAction } from "@base-template/db/schema/restaurant-staff";
import { ORPCError } from "@orpc/server";
import { and, eq, gt, isNull } from "drizzle-orm";

import type { Clock } from "../context";
import { recordAuditThrough } from "./audit-in-transaction";
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
 * Spends an Override for a guarded action and returns its approver. Atomic and bound to Location,
 * action and target; a refused attempt never burns it. See docs/architecture/restaurant.md#overrides.
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
      data: { reason: "override_invalid" },
    });
  }

  // Through the caller's executor so it rolls back with the spend.
  await recordAuditThrough(deps.db, {
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
