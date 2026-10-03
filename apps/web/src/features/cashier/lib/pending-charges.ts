import { tenderLabel, type Tender } from "@base-template/ui/lib/bill-ledger";
import { formatCop } from "@base-template/ui/lib/format-cop";
import type { StatusOf } from "@base-template/ui/lib/status-labels";

import { describeCheckoutError } from "./checkout-errors";

type QueueStatus = StatusOf<"sync">;

type QueuedRecord = {
  idempotencyKey: string;
  kind: string;
  status: QueueStatus;
  waitingOn?: "session" | "override";
  deviceRecordedAt: string;
  payload: Record<string, unknown>;
  lastError?: { code: string; message: string };
};

export type ChargeRow = {
  key: string;
  kind: "payment" | "document";
  title: string;
  detail: string | null;
  status: QueueStatus;
  /** ISO original sale time. */
  saleTime: string;
  canRetry: boolean;
};

const DETAIL_GENERIC = "No pudimos completar la acción.";

function detailOf(record: QueuedRecord): string | null {
  if (record.status === "rejected") {
    const copy = describeCheckoutError(record.lastError);
    return copy === DETAIL_GENERIC && record.lastError?.message
      ? `${copy} (${record.lastError.message})`
      : copy;
  }
  if (record.status === "waiting") {
    return record.waitingOn === "session"
      ? "Espera a que se registre la mesa."
      : "Espera una autorización.";
  }
  if (record.status === "failed") {
    return "Sin conexión con el servidor: se reintenta solo.";
  }
  return null;
}

/** Charges and DIAN document requests not yet synced, oldest sale first, for the "Pendientes" view. */
export function chargeRows(
  records: readonly QueuedRecord[],
  tableOf: (sessionId: string) => string | undefined,
): ChargeRow[] {
  return records
    .filter(
      (record) =>
        record.status !== "synced" &&
        (record.kind === "payment" ||
          record.kind === "takings" ||
          record.kind === "document_request"),
    )
    .toSorted((a, b) => a.deviceRecordedAt.localeCompare(b.deviceRecordedAt))
    .map((record): ChargeRow => {
      const table = tableOf(String(record.payload.tableSessionId ?? ""));
      const where = table ? ` · ${table}` : "";
      const isDocument = record.kind === "document_request";
      const title = isDocument
        ? `Documento para la DIAN${where}`
        : `${tenderLabel(record.payload.tender as Tender)} ${formatCop(Number(record.payload.amount))}${where}`;
      return {
        key: record.idempotencyKey,
        kind: isDocument ? "document" : "payment",
        title,
        detail: detailOf(record),
        status: record.status,
        saleTime: record.deviceRecordedAt,
        canRetry: record.status === "rejected" || record.status === "failed",
      };
    });
}

export type ChecklistItem = { id: string; label: string; count: number; done: boolean };

/** The offline checklist: what is still to send, to transmit to the DIAN and to review. */
export function chargeChecklist(rows: readonly ChargeRow[]): ChecklistItem[] {
  const pending = (kind: ChargeRow["kind"]) =>
    rows.filter((row) => row.kind === kind && row.status !== "rejected").length;
  const rejected = rows.filter((row) => row.status === "rejected").length;
  return [
    { id: "payments", label: "Cobros por enviar al servidor", count: pending("payment") },
    { id: "documents", label: "Documentos por transmitir a la DIAN", count: pending("document") },
    { id: "rejected", label: "Registros rechazados por revisar", count: rejected },
  ].map((item) => ({ ...item, done: item.count === 0 }));
}
