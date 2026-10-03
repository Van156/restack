import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@base-template/ui/components/table";
import { formatCop } from "@base-template/ui/lib/format-cop";

import type { ItemRow, TotalsRow } from "../lib/margin-view";
import { MarginCell, MissingCostBadge } from "./margin-cells";

/** Quantity, revenue, cost and margin per Menu item; an item with no cost is flagged, not valued at zero. */
export default function ItemsReportView({
  rows,
  totals,
}: {
  rows: readonly ItemRow[];
  totals: TotalsRow;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Producto</TableHead>
          <TableHead className="text-right">Cantidad</TableHead>
          <TableHead className="text-right">Ventas</TableHead>
          <TableHead className="text-right">Costo</TableHead>
          <TableHead className="text-right">Margen</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.key}>
            <TableCell>{row.name}</TableCell>
            <TableCell className="text-right tabular-nums">{row.quantity}</TableCell>
            <TableCell className="text-right tabular-nums">{formatCop(row.revenue)}</TableCell>
            <TableCell className="text-right">
              {row.costMissing || row.cost === null ? (
                <MissingCostBadge />
              ) : (
                <span className="tabular-nums">{formatCop(row.cost)}</span>
              )}
            </TableCell>
            <TableCell className="text-right">
              <MarginCell margin={row.margin} percent={row.marginPercent} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell colSpan={2}>Total</TableCell>
          <TableCell className="text-right tabular-nums">{formatCop(totals.revenue)}</TableCell>
          <TableCell className="text-right tabular-nums">{formatCop(totals.cost)}</TableCell>
          <TableCell className="space-x-2 text-right">
            <MarginCell margin={totals.margin} percent={totals.marginPercent} />
            {totals.marginIncomplete ? <MissingCostBadge label="Incompleto" /> : null}
          </TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  );
}
