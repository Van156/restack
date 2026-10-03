import { formatAge } from "@base-template/ui/lib/format-age";

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

/** Elapsed time with days once it passes 24 h: `1 d 12 h`. */
function formatSpan(ms: number): string {
  const span = Math.abs(ms);
  if (span < DAY_MS) {
    return formatAge(span);
  }
  const days = Math.floor(span / DAY_MS);
  const hours = Math.floor((span % DAY_MS) / HOUR_MS);
  return hours === 0 ? `${days} d` : `${days} d ${hours} h`;
}

const KIND_LABELS = {
  pos_equivalent: "Documento equivalente POS",
  factura: "Factura electrónica",
} as const;

/** One row of `dian.listOutbox`. */
export type OutboxSource = {
  documentId: string;
  kind: keyof typeof KIND_LABELS;
  saleTime: Date;
  contingency: boolean;
  attempts: number;
  nextAttemptAt: Date;
  transmitBy: Date;
  overdue: boolean;
  lastError: string | null;
};

export type OutboxRow = {
  documentId: string;
  kindLabel: string;
  saleTime: Date;
  contingency: boolean;
  attempts: number;
  deadlineText: string;
  nextAttemptText: string;
  overdue: boolean;
  lastError: string | null;
};

/** Pending documents with the time left before the 48 h deadline and the next attempt. */
export function toOutboxRows(rows: readonly OutboxSource[], now: Date): OutboxRow[] {
  return rows.map((row) => {
    const untilDeadline = row.transmitBy.getTime() - now.getTime();
    const untilAttempt = row.nextAttemptAt.getTime() - now.getTime();
    return {
      documentId: row.documentId,
      kindLabel: KIND_LABELS[row.kind],
      saleTime: row.saleTime,
      contingency: row.contingency,
      attempts: row.attempts,
      deadlineText:
        untilDeadline >= 0
          ? `Quedan ${formatSpan(untilDeadline)}`
          : `Venció hace ${formatSpan(untilDeadline)}`,
      nextAttemptText: untilAttempt <= 0 ? "Ahora" : `En ${formatSpan(untilAttempt)}`,
      overdue: row.overdue,
      lastError: row.lastError,
    };
  });
}

const CAUSE_LABELS: Record<string, string> = {
  provider_unavailable: "El proveedor no estaba disponible",
  offline_sale: "Ventas registradas sin conexión",
};

export function incidentCauseLabel(cause: string): string {
  return CAUSE_LABELS[cause] ?? cause;
}

/** One row of `dian.listIncidents`. */
export type IncidentSource = {
  id: string;
  cause: string;
  startedAt: Date;
  endedAt: Date | null;
  documentsCovered: number;
  reported: boolean;
};

export type IncidentRow = {
  id: string;
  causeLabel: string;
  startedAt: Date;
  endedAt: Date | null;
  open: boolean;
  durationText: string;
  documentsCovered: number;
};

/** The incident log: each period documents could not be transmitted, an open one counted up to now. */
export function toIncidentRows(rows: readonly IncidentSource[], now: Date): IncidentRow[] {
  return rows.map((row) => ({
    id: row.id,
    causeLabel: incidentCauseLabel(row.cause),
    startedAt: row.startedAt,
    endedAt: row.endedAt,
    open: row.endedAt === null,
    durationText: formatSpan((row.endedAt ?? now).getTime() - row.startedAt.getTime()),
    documentsCovered: row.documentsCovered,
  }));
}

const FAIR_USE = 5_000;
const monthFormat = new Intl.DateTimeFormat("es-CO", {
  timeZone: "UTC",
  month: "long",
  year: "numeric",
});

export type CountRow = { month: string; label: string; count: number; overFairUse: boolean };

/** Documents issued per month (`YYYY-MM`), flagging the fair-use ceiling. */
export function toCountRows(rows: readonly { month: string; count: number }[]): CountRow[] {
  return rows.map((row) => {
    const [year = 0, month = 1] = row.month.split("-").map(Number);
    return {
      month: row.month,
      label: monthFormat.format(new Date(Date.UTC(year, month - 1, 15))),
      count: row.count,
      overFairUse: row.count > FAIR_USE,
    };
  });
}
