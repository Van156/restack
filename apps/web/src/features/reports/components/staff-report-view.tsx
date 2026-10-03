import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@base-template/ui/components/table";
import { formatCop } from "@base-template/ui/lib/format-cop";

import type { StaffRow } from "../lib/margin-view";
import { MarginCell, MissingCostBadge } from "./margin-cells";

/** Sales, tips, cost and margin per person who closed the Bills; the margin leaves out items without cost. */
export default function StaffReportView({ rows }: { rows: readonly StaffRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Persona</TableHead>
          <TableHead className="text-right">Cuentas</TableHead>
          <TableHead className="text-right">Ventas</TableHead>
          <TableHead className="text-right">Propinas</TableHead>
          <TableHead className="text-right">Costo</TableHead>
          <TableHead className="text-right">Margen</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.key}>
            <TableCell>{row.name}</TableCell>
            <TableCell className="text-right tabular-nums">{row.billCount}</TableCell>
            <TableCell className="text-right tabular-nums">{formatCop(row.salesTotal)}</TableCell>
            <TableCell className="text-right tabular-nums">{formatCop(row.tipTotal)}</TableCell>
            <TableCell className="text-right tabular-nums">{formatCop(row.cost)}</TableCell>
            <TableCell className="space-x-2 text-right">
              <MarginCell margin={row.margin} percent={row.marginPercent} />
              {row.marginIncomplete ? <MissingCostBadge label="Incompleto" /> : null}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
