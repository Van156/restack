import type { CsvColumn } from "@/shared/lib/data-table/csv";

import {
  formatUserAuditAction,
  formatUserAuditDetail,
  resolveActorLabel,
} from "./audit-log-display";
import type { ActorRef } from "./audit-log-display";

/** The audit row fields the CSV export reads. */
export type AuditCsvRow = {
  scope: string;
  organizationId: string | null;
  actorUserId: string | null;
  action: string;
  targetType: string;
  targetId: string;
  createdAt: Date;
};

const when: CsvColumn<AuditCsvRow> = { header: "When", value: (row) => row.createdAt };
const actorId: CsvColumn<AuditCsvRow> = { header: "Actor ID", value: (row) => row.actorUserId };
const action: CsvColumn<AuditCsvRow> = { header: "Action", value: (row) => row.action };
const targetType: CsvColumn<AuditCsvRow> = {
  header: "Target type",
  value: (row) => row.targetType,
};
const targetId: CsvColumn<AuditCsvRow> = { header: "Target ID", value: (row) => row.targetId };

function actor(members: readonly ActorRef[]): CsvColumn<AuditCsvRow> {
  return { header: "Actor", value: (row) => resolveActorLabel(row.actorUserId, members) };
}

/** CSV columns of the organization log export: machine values (ISO time, raw action) plus the actor's name. */
export function getOrgAuditCsvColumns(members: readonly ActorRef[]): CsvColumn<AuditCsvRow>[] {
  return [when, actor(members), actorId, action, targetType, targetId];
}

/** CSV columns of the platform log export (no member directory: the actor is a shortened id). */
export function getPlatformAuditCsvColumns(): CsvColumn<AuditCsvRow>[] {
  return [
    when,
    { header: "Scope", value: (row) => row.scope },
    { header: "Organization ID", value: (row) => row.organizationId },
    actor([]),
    actorId,
    action,
    targetType,
    targetId,
  ];
}

/** A listed security log row: the CSV fields plus the `metadata` snapshot the detail is read from. */
export type UserAuditCsvRow = AuditCsvRow & { metadata: unknown };

/** CSV columns of the security log export: ISO time, the raw action and the readable detail. */
export function getUserAuditCsvColumns(): CsvColumn<UserAuditCsvRow>[] {
  return [
    when,
    action,
    { header: "Label", value: (row) => formatUserAuditAction(row.action) },
    { header: "Detail", value: (row) => formatUserAuditDetail(row) },
  ];
}
