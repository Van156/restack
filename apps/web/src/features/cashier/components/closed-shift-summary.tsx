import { formatCop } from "@base-template/ui/lib/format-cop";
import type { ReactNode } from "react";

import {
  SHIFT_TENDERS,
  closeDifferences,
  differenceCopy,
  type TenderAmounts,
} from "../lib/shift-form";
import { tenderLabel } from "@base-template/ui/lib/bill-ledger";

/** What the shift that just closed counted against what was expected; `children` hold the tip distribution. */
export default function ClosedShiftSummary({
  expected,
  counted,
  children,
}: {
  expected: TenderAmounts;
  counted: TenderAmounts;
  children?: ReactNode;
}) {
  const { rows, total } = closeDifferences(expected, counted);
  return (
    <section aria-label="Turno cerrado" className="space-y-3 rounded-md border p-3">
      <h3 className="font-medium">Turno cerrado</h3>
      <ul className="space-y-1 text-sm">
        {SHIFT_TENDERS.map((tender) => {
          const row = rows.find((candidate) => candidate.tender === tender)!;
          return (
            <li key={tender} className="flex justify-between gap-2">
              <span>{tenderLabel(tender)}</span>
              <span className="tabular-nums">
                Contado {formatCop(row.counted)} · esperado {formatCop(row.expected)} ·{" "}
                {differenceCopy(row.difference)}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="font-medium">Diferencia total: {differenceCopy(total)}</p>
      {children}
    </section>
  );
}
