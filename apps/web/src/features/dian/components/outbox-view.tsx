import { Badge } from "@base-template/ui/components/badge";
import { Button } from "@base-template/ui/components/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@base-template/ui/components/table";
import { formatSaleTime } from "@base-template/ui/lib/sale-time";

import type { OutboxRow } from "../lib/dian-rows";

/** Documents not yet transmitted, with the 48 h deadline and a retry now. */
export default function OutboxView({
  rows,
  retryingId,
  onRetry,
}: {
  rows: readonly OutboxRow[];
  /** The document being retried, to disable only its button. */
  retryingId: string | null;
  onRetry: (documentId: string) => void;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Documento</TableHead>
          <TableHead>Venta</TableHead>
          <TableHead className="text-right">Intentos</TableHead>
          <TableHead>Plazo de 48 h</TableHead>
          <TableHead>Próximo intento</TableHead>
          <TableHead>Último error</TableHead>
          <TableHead className="text-right">
            <span className="sr-only">Acciones</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.documentId}>
            <TableCell>
              {row.kindLabel}
              {row.contingency ? (
                <Badge variant="outline" className="ml-2">
                  Sin conexión
                </Badge>
              ) : null}
            </TableCell>
            <TableCell>{formatSaleTime(row.saleTime)}</TableCell>
            <TableCell className="text-right tabular-nums">{row.attempts}</TableCell>
            <TableCell>
              <span className={row.overdue ? "font-medium text-destructive" : undefined}>
                {row.deadlineText}
              </span>
            </TableCell>
            <TableCell>{row.nextAttemptText}</TableCell>
            <TableCell className="max-w-64 truncate text-muted-foreground">
              {row.lastError ?? "—"}
            </TableCell>
            <TableCell className="text-right">
              <Button
                size="sm"
                variant="outline"
                disabled={retryingId === row.documentId}
                aria-label={`Reintentar ahora: ${row.kindLabel}`}
                onClick={() => onRetry(row.documentId)}
              >
                Reintentar
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
