import type { QueueRecord, QueueStatus } from "@/features/offline-queue";

import { refusalCopy } from "./refusal-copy";

export type PendingRow = {
  key: string;
  label: string;
  status: QueueStatus;
  message?: string;
  action: "retry" | "authorize" | null;
  /** For `authorize`: the Order line the Override is for. */
  overrideTarget?: string;
};

type Names = {
  table: (id: string) => string | undefined;
  item: (id: string) => string | undefined;
};

const text = (record: QueueRecord, field: string): string | undefined => {
  const value = record.payload[field];
  return typeof value === "string" ? value : undefined;
};

function label(record: QueueRecord, names: Names): string {
  const table = names.table(text(record, "tableId") ?? "") ?? "mesa";
  switch (record.kind) {
    case "open_session":
      return `Abrir ${table}`;
    case "move_session":
      return `Mover a ${table}`;
    case "order_line":
      return `Agregar ${Number(record.payload.quantity ?? 1)} × ${names.item(text(record, "menuItemId") ?? "") ?? "producto"}`;
    case "void":
      return "Anular una línea";
    case "send_to_kitchen":
      return "Enviar a cocina";
    default:
      return "Registro pendiente";
  }
}

function message(record: QueueRecord): string | undefined {
  if (record.status === "waiting") {
    return record.waitingOn === "override"
      ? "Esperando la autorización de un Administrador."
      : "Esperando que se abra la mesa.";
  }
  if (record.status === "failed") {
    return "No se pudo enviar; se reintenta solo.";
  }
  if (record.status === "rejected") {
    const error = record.lastError;
    return (
      (error && refusalCopy(error)) ?? `El servidor lo rechazó: ${error?.message ?? "sin detalle"}`
    );
  }
  return undefined;
}

/** Records still to send or needing attention, oldest first, with what the Waiter can do. */
export function pendingRows(records: readonly QueueRecord[], names: Names): PendingRow[] {
  return records
    .filter((record) => record.status !== "synced")
    .map((record): PendingRow => {
      const needsOverride = record.kind === "void" && record.waitingOn === "override";
      return {
        key: record.idempotencyKey,
        label: label(record, names),
        status: record.status,
        message: message(record),
        action: needsOverride
          ? "authorize"
          : record.status === "failed" || record.status === "rejected"
            ? "retry"
            : null,
        ...(needsOverride ? { overrideTarget: text(record, "lineId") } : {}),
      };
    });
}
