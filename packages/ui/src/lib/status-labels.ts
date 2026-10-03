/** The statuses each kind of badge can show; they mirror the server enums without importing them. */
export const STATUS_KINDS = {
  ticket: ["nuevo", "preparando", "listo", "entregado"],
  session: ["open", "bill_requested", "settled"],
  document: ["pending", "issued", "rejected"],
  sync: ["pending", "waiting", "failed", "rejected", "synced"],
} as const;

export type StatusKind = keyof typeof STATUS_KINDS;
export type StatusOf<K extends StatusKind> = (typeof STATUS_KINDS)[K][number];
export type StatusTone = "default" | "secondary" | "success" | "warning" | "info" | "destructive";

type StatusMeta = { label: string; tone: StatusTone };

const STATUS_META: { [K in StatusKind]: Record<StatusOf<K>, StatusMeta> } = {
  ticket: {
    nuevo: { label: "Nuevo", tone: "info" },
    preparando: { label: "Preparando", tone: "warning" },
    listo: { label: "Listo para entregar", tone: "success" },
    entregado: { label: "Entregado", tone: "secondary" },
  },
  session: {
    open: { label: "Abierta", tone: "info" },
    bill_requested: { label: "Cuenta solicitada", tone: "warning" },
    settled: { label: "Pagada", tone: "success" },
  },
  document: {
    pending: { label: "Pendiente", tone: "warning" },
    issued: { label: "Emitido", tone: "success" },
    rejected: { label: "Rechazado", tone: "destructive" },
  },
  sync: {
    pending: { label: "Pendiente", tone: "warning" },
    waiting: { label: "En espera", tone: "info" },
    failed: { label: "Fallido", tone: "destructive" },
    rejected: { label: "Rechazado", tone: "destructive" },
    synced: { label: "Sincronizado", tone: "success" },
  },
};

/** Spanish label of a status. */
export function statusLabel<K extends StatusKind>(kind: K, status: StatusOf<K>): string {
  return STATUS_META[kind][status].label;
}

/** Badge tone of a status: failures are destructive, finished work is success. */
export function statusTone<K extends StatusKind>(kind: K, status: StatusOf<K>): StatusTone {
  return STATUS_META[kind][status].tone;
}
