import type { QueueRecord } from "@/features/offline-queue";

import type { LineRef } from "./order-action";
import { isUnapplied, type MenuIndex } from "./queued-view";

export type ServerLine = {
  id: string;
  idempotencyKey: string;
  itemName: string;
  unitPrice: number;
  quantity: number;
  modifiers: { modifierId: string; name: string; priceDelta: number }[];
  note: string | null;
  voided: boolean;
  /** The Ticket the line was sent on; null while it is still unsent. */
  ticketId: string | null;
};

/** What a queued record still has to do to a line. */
export type LinePending = "queued" | "void_queued" | "void_needs_override" | null;

export type OrderViewLine = {
  id: string;
  ref: LineRef;
  idempotencyKey: string;
  quantity: number;
  name: string;
  modifiers: string[];
  note: string | null;
  state: "unsent" | "sent" | "voided";
  total: number;
  pending: LinePending;
  /** Key of the queued void, so its Override can be attached later. */
  voidKey?: string;
};

export type OrderView = { lines: OrderViewLine[]; total: number; hasUnsent: boolean };

/** Queued records of this device that belong to the session being shown. */
export type QueuedOverlay = {
  records: readonly QueueRecord[];
  sessionId: string | null;
  sessionKeys: readonly string[];
  menu: MenuIndex;
};

/** Line total in integer COP at the price recorded with the line. */
export function lineTotal(line: {
  unitPrice: number;
  quantity: number;
  modifiers: readonly { priceDelta: number }[];
}): number {
  const deltas = line.modifiers.reduce((sum, modifier) => sum + modifier.priceDelta, 0);
  return (line.unitPrice + deltas) * line.quantity;
}

const text = (record: QueueRecord, field: string): string | undefined => {
  const value = record.payload[field];
  return typeof value === "string" ? value : undefined;
};

function namesSession(record: QueueRecord, overlay: QueuedOverlay): boolean {
  const sessionId = text(record, "tableSessionId");
  const sessionKey = text(record, "sessionKey");
  return (
    (sessionId !== undefined && sessionId === overlay.sessionId) ||
    (sessionKey !== undefined && overlay.sessionKeys.includes(sessionKey))
  );
}

type QueuedModifier = { modifierId: string; priceDelta: number };

function queuedLine(record: QueueRecord, menu: MenuIndex): OrderViewLine {
  const itemId = text(record, "menuItemId") ?? "";
  const modifiers = (record.payload.modifiers as QueuedModifier[] | undefined) ?? [];
  const quantity = Number(record.payload.quantity ?? 1);
  const unitPrice = Number(record.payload.unitPrice ?? 0);
  return {
    id: record.idempotencyKey,
    ref: { lineKey: record.idempotencyKey },
    idempotencyKey: record.idempotencyKey,
    quantity,
    name: menu.itemName(itemId) ?? "Producto",
    modifiers: modifiers.map((modifier) => menu.modifierName(modifier.modifierId) ?? "Opción"),
    note: text(record, "note") ?? null,
    state: "unsent",
    total: lineTotal({ unitPrice, quantity, modifiers }),
    pending: "queued",
  };
}

function fromServer(line: ServerLine): OrderViewLine {
  return {
    id: line.id,
    ref: { lineId: line.id },
    idempotencyKey: line.idempotencyKey,
    quantity: line.quantity,
    name: line.itemName,
    modifiers: line.modifiers.map((modifier) => modifier.name),
    note: line.note,
    state: line.voided ? "voided" : line.ticketId ? "sent" : "unsent",
    total: lineTotal(line),
    pending: null,
  };
}

/** Applies the queued voids: an unsent line disappears, a sent one waits for its Override and sync. */
function applyVoids(lines: OrderViewLine[], voids: readonly QueueRecord[]): OrderViewLine[] {
  return lines.map((line) => {
    const queuedVoid = voids.find(
      (record) =>
        text(record, "lineId") === line.id || text(record, "lineKey") === line.idempotencyKey,
    );
    if (!queuedVoid || line.state === "voided") {
      return line;
    }
    if (line.state === "unsent") {
      return { ...line, state: "voided" as const };
    }
    return {
      ...line,
      pending: queuedVoid.overrideId ? ("void_queued" as const) : ("void_needs_override" as const),
      voidKey: queuedVoid.idempotencyKey,
    };
  });
}

/** Lines for the order strip with the order total (voided lines excluded). */
export function buildOrderView(lines: readonly ServerLine[], overlay?: QueuedOverlay): OrderView {
  const unapplied = overlay ? overlay.records.filter(isUnapplied) : [];
  const serverKeys = new Set(lines.map((line) => line.idempotencyKey));
  const queued = overlay
    ? unapplied
        .filter((record) => record.kind === "order_line")
        .filter((record) => namesSession(record, overlay) && !serverKeys.has(record.idempotencyKey))
        .map((record) => queuedLine(record, overlay.menu))
    : [];
  const voids = unapplied.filter((record) => record.kind === "void");
  const view = applyVoids([...lines.map(fromServer), ...queued], voids);
  return {
    lines: view,
    total: view.reduce((sum, line) => (line.state === "voided" ? sum : sum + line.total), 0),
    hasUnsent: view.some((line) => line.state === "unsent" && line.pending === null),
  };
}
