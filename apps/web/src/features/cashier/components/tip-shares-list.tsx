import { formatCop } from "@base-template/ui/lib/format-cop";

import type { ReportShare } from "../lib/tip-report";

/** Who receives how much of a tip total. */
export default function TipSharesList({
  shares,
  total,
  label,
}: {
  shares: readonly ReportShare[];
  total: number;
  label: string;
}) {
  return (
    <div className="space-y-1">
      <ul aria-label={label} className="divide-y rounded-md border">
        {shares.map((share) => (
          <li key={share.key} className="flex justify-between gap-2 p-2 text-sm">
            <span>{share.displayName}</span>
            <span className="tabular-nums">{formatCop(share.amount)}</span>
          </li>
        ))}
      </ul>
      <p className="text-right text-sm font-medium">Total de propinas {formatCop(total)}</p>
    </div>
  );
}
