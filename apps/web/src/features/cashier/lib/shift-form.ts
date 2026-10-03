import type { Tender } from "@base-template/ui/lib/bill-ledger";
import { formatCop } from "@base-template/ui/lib/format-cop";

import { parsePesos } from "./payment-form";

export const SHIFT_TENDERS: readonly Tender[] = ["cash", "card", "qr_transfer"];

export type TenderAmounts = Record<Tender, number>;

export type OpeningParse = { ok: true; amount: number } | { ok: false; error: string };

/** The cash in the drawer when the shift opens: zero or whole pesos. */
export function parseOpeningAmount(text: string): OpeningParse {
  const amount = parsePesos(text);
  return amount === null
    ? { ok: false, error: "Escribe el efectivo inicial en pesos enteros, o 0." }
    : { ok: true, amount };
}

export type CountedParse =
  | { ok: true; counted: TenderAmounts }
  | { ok: false; errors: Partial<Record<Tender, string>> };

/** The amount counted for each tender at close; every tender must be filled in, zero included. */
export function parseCounted(draft: Record<Tender, string>): CountedParse {
  const counted: Partial<TenderAmounts> = {};
  const errors: Partial<Record<Tender, string>> = {};
  for (const tender of SHIFT_TENDERS) {
    const amount = parsePesos(draft[tender]);
    if (amount === null) {
      errors[tender] = "Escribe lo contado en pesos enteros, o 0.";
    } else {
      counted[tender] = amount;
    }
  }
  return Object.keys(errors).length > 0
    ? { ok: false, errors }
    : { ok: true, counted: counted as TenderAmounts };
}

export type TenderDifference = {
  tender: Tender;
  expected: number;
  counted: number;
  difference: number;
};

/**
 * Counted against expected for each tender. Any tender off its figure needs an Override, so
 * differences that cancel out in the total cannot hide.
 */
export function closeDifferences(
  expected: TenderAmounts,
  counted: TenderAmounts,
): { rows: TenderDifference[]; total: number; needsOverride: boolean } {
  const rows = SHIFT_TENDERS.map((tender) => ({
    tender,
    expected: expected[tender],
    counted: counted[tender],
    difference: counted[tender] - expected[tender],
  }));
  return {
    rows,
    total: rows.reduce((sum, row) => sum + row.difference, 0),
    needsOverride: rows.some((row) => row.difference !== 0),
  };
}

/** "Cuadra", "Faltan $ x" or "Sobran $ x". */
export function differenceCopy(difference: number): string {
  if (difference === 0) {
    return "Cuadra";
  }
  return difference < 0 ? `Faltan ${formatCop(-difference)}` : `Sobran ${formatCop(difference)}`;
}

export type TakingRow = {
  id: string;
  tender: Tender;
  amount: number;
  reference: string | null;
  /** ISO original sale time. */
  saleTime: string;
};

/** Takings flagged "registrado sin conexión", by their original sale time, for review at close. */
export function toTakingRows(
  payments: readonly {
    id: string;
    tender: Tender;
    amount: number;
    reference: string | null;
    recordedAt: Date;
    clientRecordedAt: Date | null;
  }[],
): TakingRow[] {
  return payments
    .map((payment) => ({
      id: payment.id,
      tender: payment.tender,
      amount: payment.amount,
      reference: payment.reference,
      saleTime: (payment.clientRecordedAt ?? payment.recordedAt).toISOString(),
    }))
    .toSorted((a, b) => a.saleTime.localeCompare(b.saleTime));
}
