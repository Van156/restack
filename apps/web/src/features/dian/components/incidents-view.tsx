import { Badge } from "@base-template/ui/components/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@base-template/ui/components/table";
import { formatSaleTime } from "@base-template/ui/lib/sale-time";

import type { IncidentRow } from "../lib/dian-rows";

/** The incident log: each period documents could not be transmitted, as evidence for the DIAN. */
export default function IncidentsView({ rows }: { rows: readonly IncidentRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Causa</TableHead>
          <TableHead>Inicio</TableHead>
          <TableHead>Fin</TableHead>
          <TableHead>Duración</TableHead>
          <TableHead className="text-right">Documentos</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell>{row.causeLabel}</TableCell>
            <TableCell>{formatSaleTime(row.startedAt)}</TableCell>
            <TableCell>
              {row.endedAt ? formatSaleTime(row.endedAt) : <Badge variant="warning">Abierto</Badge>}
            </TableCell>
            <TableCell>{row.durationText}</TableCell>
            <TableCell className="text-right tabular-nums">{row.documentsCovered}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
