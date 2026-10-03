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

export type OrderViewLine = {
  id: string;
  idempotencyKey: string;
  quantity: number;
  name: string;
  modifiers: string[];
  note: string | null;
  state: "unsent" | "sent" | "voided";
  total: number;
};

export type OrderView = { lines: OrderViewLine[]; total: number; hasUnsent: boolean };

/** Line total in integer COP at the price recorded with the line. */
export function lineTotal(line: {
  unitPrice: number;
  quantity: number;
  modifiers: readonly { priceDelta: number }[];
}): number {
  const deltas = line.modifiers.reduce((sum, modifier) => sum + modifier.priceDelta, 0);
  return (line.unitPrice + deltas) * line.quantity;
}

/** Lines for the order strip with the order total (voided lines excluded). */
export function buildOrderView(lines: readonly ServerLine[]): OrderView {
  const view = lines.map((line): OrderViewLine => ({
    id: line.id,
    idempotencyKey: line.idempotencyKey,
    quantity: line.quantity,
    name: line.itemName,
    modifiers: line.modifiers.map((modifier) => modifier.name),
    note: line.note,
    state: line.voided ? "voided" : line.ticketId ? "sent" : "unsent",
    total: lineTotal(line),
  }));
  return {
    lines: view,
    total: view.reduce((sum, line) => (line.state === "voided" ? sum : sum + line.total), 0),
    hasUnsent: view.some((line) => line.state === "unsent"),
  };
}
