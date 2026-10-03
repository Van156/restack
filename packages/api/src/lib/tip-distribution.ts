import { parseRoles } from "@base-template/auth/role-names";
import { orgRoles } from "@base-template/auth/permissions/org";
import { splitTips } from "@base-template/db/lib/tip-split";
import * as schema from "@base-template/db/schema";
import { and, asc, eq, inArray } from "drizzle-orm";

import { recordAuditThrough } from "./audit-in-transaction";
import { shiftTipTotal } from "./cash-shift";
import type { CashShiftRow } from "./cash-shift";
import type { DbExecutor } from "./executor";

const EXCLUDED_ROLES = ["owner", "admin"];

export type TipBeneficiaryRow = typeof schema.tipBeneficiary.$inferSelect;
export type TipDistributionRow = typeof schema.tipDistribution.$inferSelect;

/** The Owner and Administrators never share tips; checked on every Role of the member. */
export const isTipExcludedRole = (role: string) =>
  parseRoles(role).some((name) => EXCLUDED_ROLES.includes(name));

const mayCharge = (name: string) =>
  name in orgRoles &&
  (
    orgRoles[name as keyof typeof orgRoles].statements as Record<string, readonly string[]>
  ).billing?.includes("charge") === true;

/**
 * Default tip group of a Location: Waiters plus non-charging Staff, never the Owner or an
 * Administrator. See docs/architecture/restaurant.md#tip-distribution.
 */
export async function defaultTipGroup(
  db: DbExecutor,
  target: { organizationId: string; locationId: string },
): Promise<{ memberId: string; displayName: string }[]> {
  const rows = await db
    .select({ memberId: schema.member.id, role: schema.member.role, displayName: schema.user.name })
    .from(schema.staffLocationAssignment)
    .innerJoin(schema.member, eq(schema.member.id, schema.staffLocationAssignment.memberId))
    .innerJoin(schema.user, eq(schema.user.id, schema.member.userId))
    .where(
      and(
        eq(schema.staffLocationAssignment.locationId, target.locationId),
        eq(schema.staffLocationAssignment.organizationId, target.organizationId),
      ),
    )
    .orderBy(asc(schema.user.name), asc(schema.member.id));
  return rows
    .filter((row) => {
      if (isTipExcludedRole(row.role)) {
        return false;
      }
      const roles = parseRoles(row.role);
      return roles.includes("waiter") || !roles.some(mayCharge);
    })
    .map(({ memberId, displayName }) => ({ memberId, displayName }));
}

/** Whole percents in the same proportions that add up to 100 again (largest remainder). */
function rescalePercents(percents: number[]): number[] {
  const sum = percents.reduce((total, percent) => total + percent, 0);
  const scaled = percents.map((percent) => Math.floor((percent * 100) / sum));
  const order = percents
    .map((percent, index) => ({ index, fraction: (percent * 100) % sum }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);
  let leftover = 100 - scaled.reduce((total, value) => total + value, 0);
  for (const { index } of order) {
    if (leftover === 0) break;
    scaled[index]! += 1;
    leftover -= 1;
  }
  return scaled;
}

/**
 * The beneficiaries to pay out now: the configured list minus members who became Owner or
 * Administrator, else the default group. See docs/architecture/restaurant.md#tip-distribution.
 */
async function resolveBeneficiaries(
  tx: DbExecutor,
  shift: CashShiftRow,
): Promise<TipBeneficiaryRow[]> {
  const configured = await tx
    .select()
    .from(schema.tipBeneficiary)
    .where(eq(schema.tipBeneficiary.cashShiftId, shift.id))
    .orderBy(asc(schema.tipBeneficiary.position));
  const memberIds = configured.flatMap((row) => (row.memberId ? [row.memberId] : []));
  const roles =
    memberIds.length === 0
      ? []
      : await tx
          .select({ id: schema.member.id, role: schema.member.role })
          .from(schema.member)
          .where(inArray(schema.member.id, memberIds));
  const excluded = new Set(roles.filter((row) => isTipExcludedRole(row.role)).map((row) => row.id));
  const removed = configured.filter((row) => row.memberId && excluded.has(row.memberId));
  let kept = configured.filter((row) => !removed.includes(row));
  if (removed.length > 0) {
    await tx.delete(schema.tipBeneficiary).where(
      inArray(
        schema.tipBeneficiary.id,
        removed.map((row) => row.id),
      ),
    );
    if (kept.length > 0 && kept.every((row) => row.sharePercent !== null)) {
      const percents = rescalePercents(kept.map((row) => row.sharePercent!));
      kept = await Promise.all(
        kept.map(async (row, index) => {
          const [updated] = await tx
            .update(schema.tipBeneficiary)
            .set({ sharePercent: percents[index]! })
            .where(eq(schema.tipBeneficiary.id, row.id))
            .returning();
          return updated!;
        }),
      );
    }
  }
  if (kept.length > 0) {
    return kept;
  }
  const defaults = await defaultTipGroup(tx, shift);
  if (defaults.length === 0) {
    return [];
  }
  return tx
    .insert(schema.tipBeneficiary)
    .values(
      defaults.map((entry, position) => ({
        organizationId: shift.organizationId,
        cashShiftId: shift.id,
        memberId: entry.memberId,
        displayName: entry.displayName,
        sharePercent: null,
        position,
      })),
    )
    .returning();
}

/**
 * Distributes a closed, locked shift's tips once as a snapshot and audits `tip.distributed`;
 * empty when nobody is eligible. See docs/architecture/restaurant.md#tip-distribution.
 */
export async function distributeShiftTips(
  tx: DbExecutor,
  target: { shift: CashShiftRow; actorUserId: string },
): Promise<TipDistributionRow[]> {
  const { shift } = target;
  const existing = await tx
    .select()
    .from(schema.tipDistribution)
    .where(eq(schema.tipDistribution.cashShiftId, shift.id));
  if (existing.length > 0) {
    return orderLikeBeneficiaries(tx, shift.id, existing);
  }
  const beneficiaries = await resolveBeneficiaries(tx, shift);
  if (beneficiaries.length === 0) {
    return [];
  }
  const total = await shiftTipTotal(tx, shift.id);
  const amounts = splitTips(total, beneficiaries);
  const rows = await tx
    .insert(schema.tipDistribution)
    .values(
      beneficiaries.map((beneficiary, index) => ({
        organizationId: shift.organizationId,
        cashShiftId: shift.id,
        beneficiaryId: beneficiary.id,
        memberId: beneficiary.memberId,
        displayName: beneficiary.displayName,
        amount: amounts[index]!,
      })),
    )
    .returning();
  await recordAuditThrough(tx, {
    scope: "organization",
    organizationId: shift.organizationId,
    actorUserId: target.actorUserId,
    action: "tip.distributed",
    targetType: "cash_shift",
    targetId: shift.id,
    metadata: {
      locationId: shift.locationId,
      total,
      shares: rows.map((row) => ({
        beneficiaryId: row.beneficiaryId,
        displayName: row.displayName,
        amount: row.amount,
      })),
    },
  });
  return orderLikeBeneficiaries(tx, shift.id, rows);
}

async function orderLikeBeneficiaries(
  tx: DbExecutor,
  cashShiftId: string,
  rows: TipDistributionRow[],
): Promise<TipDistributionRow[]> {
  const beneficiaries = await tx
    .select({ id: schema.tipBeneficiary.id, position: schema.tipBeneficiary.position })
    .from(schema.tipBeneficiary)
    .where(eq(schema.tipBeneficiary.cashShiftId, cashShiftId));
  const position = new Map(beneficiaries.map((row) => [row.id, row.position]));
  return [...rows].sort(
    (a, b) => (position.get(a.beneficiaryId) ?? 0) - (position.get(b.beneficiaryId) ?? 0),
  );
}
