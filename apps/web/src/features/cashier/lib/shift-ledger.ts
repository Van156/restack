import type { Tender } from "@base-template/ui/lib/bill-ledger";

import type { TenderAmounts } from "./shift-form";

export type ShiftLedgerView = {
  shiftId: string;
  openingAmount: number;
  /** ISO time the shift opened. */
  openedAt: string;
  takings: Record<Tender, { amount: number; count: number }>;
  tips: number;
  changeGiven: number;
  expected: TenderAmounts & { total: number };
};

/** What `cashShift.ledger` returns, as far as the screen reads it. */
export type ShiftLedgerSource = Omit<ShiftLedgerView, "shiftId" | "openingAmount" | "openedAt"> & {
  shift: { id: string; openingAmount: number; openedAt: Date };
};

export function toShiftLedgerView(source: ShiftLedgerSource): ShiftLedgerView {
  return {
    shiftId: source.shift.id,
    openingAmount: source.shift.openingAmount,
    openedAt: source.shift.openedAt.toISOString(),
    takings: source.takings,
    tips: source.tips,
    changeGiven: source.changeGiven,
    expected: source.expected,
  };
}
