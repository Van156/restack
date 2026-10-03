import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@base-template/ui/components/table";

import type { CountRow } from "../lib/dian-rows";

/** Electronic documents issued per month by this Location, flagging the 5.000 fair use. */
export default function DocumentCountsView({ rows }: { rows: readonly CountRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Mes</TableHead>
          <TableHead className="text-right">Documentos</TableHead>
          <TableHead>Uso justo</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.month}>
            <TableCell className="capitalize">{row.label}</TableCell>
            <TableCell className="text-right tabular-nums">{row.count}</TableCell>
            <TableCell
              className={row.overFairUse ? "text-amber-700 dark:text-amber-400" : undefined}
            >
              {row.overFairUse ? "Pasó de 5.000 al mes" : "Dentro de 5.000 al mes"}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
