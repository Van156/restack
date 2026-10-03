import { statusLabel, type StatusOf } from "@base-template/ui/lib/status-labels";

export type TicketStatus = StatusOf<"ticket">;

export type BoardTicketLine = {
  orderLineId: string;
  itemName: string;
  quantity: number;
  modifiers: readonly { modifierId: string; name: string }[];
  note: string | null;
  voided: boolean;
};

/** The part of a `kitchen.list` row the board reads. */
export type BoardTicket = {
  id: string;
  status: TicketStatus;
  stationName: string;
  tableName: string;
  sentByName: string | null;
  sentAt: Date;
  /** Server time since `sentAt` at the moment it answered the poll. */
  ageMs: number;
  startedAt: Date | null;
  readyAt: Date | null;
  deliveredAt: Date | null;
  lines: readonly BoardTicketLine[];
};

/** How long a step took, or has taken so far (`running`). */
export type BoardTiming = { ms: number; running: boolean };

export type AdvanceStep = { status: Exclude<TicketStatus, "nuevo">; label: string };

export type BoardCardLine = {
  id: string;
  quantity: number;
  name: string;
  modifiers: string[];
  note: string | null;
  voided: boolean;
};

export type BoardCard = {
  id: string;
  status: TicketStatus;
  stationName: string;
  tableName: string;
  waiter: string | null;
  ageMs: number;
  /** Start to ready; null until the Ticket is started. */
  preparation: BoardTiming | null;
  /** Ready to delivered; null until the Ticket is ready. */
  pickupWait: BoardTiming | null;
  lines: BoardCardLine[];
  advance: AdvanceStep | null;
};

export type BoardColumn = { status: TicketStatus; label: string; cards: BoardCard[] };

export const COLUMN_ORDER = [
  "nuevo",
  "preparando",
  "listo",
  "entregado",
] as const satisfies readonly TicketStatus[];

const NEXT_STEP: Record<TicketStatus, AdvanceStep | null> = {
  nuevo: { status: "preparando", label: "Empezar a preparar" },
  preparando: { status: "listo", label: "Marcar listo" },
  listo: { status: "entregado", label: "Marcar entregado" },
  entregado: null,
};

/** The one step a Ticket can take from `status` and its button label; `null` once delivered. */
export function advanceTarget(status: TicketStatus): AdvanceStep | null {
  return NEXT_STEP[status];
}

/**
 * Age of a Ticket: the server's own measure at the poll plus the time that passed on this device
 * since the poll arrived. The device clock is never compared with the server's `sentAt`.
 */
function ageOf(ticket: BoardTicket, sincePollMs: number): number {
  return Math.max(0, ticket.ageMs + sincePollMs);
}

/** Start to ready, and ready to delivered, measured on the server's clock where they are running. */
function timingsOf(ticket: BoardTicket, sincePollMs: number) {
  const serverNow = ticket.sentAt.getTime() + ageOf(ticket, sincePollMs);
  const between = (from: Date | null, to: Date | null): BoardTiming | null =>
    from === null
      ? null
      : { ms: Math.max(0, (to?.getTime() ?? serverNow) - from.getTime()), running: to === null };
  return {
    preparation: between(ticket.startedAt, ticket.readyAt),
    pickupWait: between(ticket.readyAt, ticket.deliveredAt),
  };
}

function byOldestFirst(a: BoardTicket, b: BoardTicket): number {
  return a.sentAt.getTime() - b.sentAt.getTime() || a.id.localeCompare(b.id);
}

function toCard(ticket: BoardTicket, sincePollMs: number): BoardCard {
  return {
    id: ticket.id,
    status: ticket.status,
    stationName: ticket.stationName,
    tableName: ticket.tableName,
    waiter: ticket.sentByName,
    ageMs: ageOf(ticket, sincePollMs),
    ...timingsOf(ticket, sincePollMs),
    advance: advanceTarget(ticket.status),
    lines: ticket.lines.map((line) => ({
      id: line.orderLineId,
      quantity: line.quantity,
      name: line.itemName,
      modifiers: line.modifiers.map((modifier) => modifier.name),
      note: line.note,
      voided: line.voided,
    })),
  };
}

/**
 * The four status columns. Open columns list the oldest Ticket first (it is the one to cook next);
 * delivered ones list the most recent first. `sincePollMs` is the time since the poll arrived.
 */
export function groupBoard(tickets: readonly BoardTicket[], sincePollMs: number): BoardColumn[] {
  return COLUMN_ORDER.map((status) => {
    const inColumn = tickets.filter((ticket) => ticket.status === status).toSorted(byOldestFirst);
    const ordered = status === "entregado" ? inColumn.toReversed() : inColumn;
    return {
      status,
      label: statusLabel("ticket", status),
      cards: ordered.map((ticket) => toCard(ticket, sincePollMs)),
    };
  });
}

export type BoardMetrics = {
  nuevo: number;
  preparando: number;
  listo: number;
  /** Age of the oldest Ticket not yet started; `null` when none waits. */
  oldestWaitingMs: number | null;
};

/**
 * Figures derived from the listed Tickets only. The full timing metrics (`kitchen.metrics`) need
 * `report:read`, which a Paired device does not hold.
 */
export function boardMetrics(tickets: readonly BoardTicket[], sincePollMs: number): BoardMetrics {
  const waiting = tickets.filter((ticket) => ticket.status === "nuevo");
  return {
    nuevo: waiting.length,
    preparando: tickets.filter((ticket) => ticket.status === "preparando").length,
    listo: tickets.filter((ticket) => ticket.status === "listo").length,
    oldestWaitingMs:
      waiting.length === 0 ? null : Math.max(...waiting.map((t) => ageOf(t, sincePollMs))),
  };
}

/**
 * Applies steps the server confirmed but the next poll has not shown yet, so a tap moves the card
 * at once. A step never pulls a Ticket back behind what the poll already reports.
 */
export function applyAdvances(
  tickets: readonly BoardTicket[],
  advanced: Readonly<Record<string, TicketStatus>>,
): BoardTicket[] {
  return tickets.map((ticket) => {
    const target = advanced[ticket.id];
    if (!target || COLUMN_ORDER.indexOf(target) <= COLUMN_ORDER.indexOf(ticket.status)) {
      return ticket;
    }
    return { ...ticket, status: target };
  });
}
