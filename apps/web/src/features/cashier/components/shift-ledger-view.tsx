import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@base-template/ui/components/table";
import { tenderLabel } from "@base-template/ui/lib/bill-ledger";
import { formatCop } from "@base-template/ui/lib/format-cop";
import { formatSaleTime } from "@base-template/ui/lib/sale-time";

import { SHIFT_TENDERS, type TakingRow } from "../lib/shift-form";
import type { ShiftLedgerView as Ledger } from "../lib/shift-ledger";

/** The open shift's ledger by tender, and the takings registered offline to review at close. */
export default function ShiftLedgerView({
  ledger,
  takings,
}: {
  ledger: Ledger;
  takings: readonly TakingRow[];
}) {
  return (
    <div className="space-y-4">
      <section aria-label="Libro del turno" className="space-y-2">
        <h3 className="font-medium">Turno abierto</h3>
        <p className="text-sm text-muted-foreground">
          Desde {formatSaleTime(new Date(ledger.openedAt))} · efectivo inicial{" "}
          {formatCop(ledger.openingAmount)}
        </p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Forma de pago</TableHead>
              <TableHead className="text-right">Cobros</TableHead>
              <TableHead className="text-right">Cobrado</TableHead>
              <TableHead className="text-right">Esperado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {SHIFT_TENDERS.map((tender) => (
              <TableRow key={tender}>
                <TableCell>{tenderLabel(tender)}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {ledger.takings[tender].count}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCop(ledger.takings[tender].amount)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCop(ledger.expected[tender])}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow className="font-semibold">
              <TableCell colSpan={3}>Total esperado</TableCell>
              <TableCell className="text-right tabular-nums">
                {formatCop(ledger.expected.total)}
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
        <p className="text-sm text-muted-foreground">
          El efectivo esperado incluye el inicial y no el cambio devuelto (
          {formatCop(ledger.changeGiven)}). Propinas del turno: {formatCop(ledger.tips)}.
        </p>
      </section>
      <section aria-label="Cobros sin conexión" className="space-y-2">
        <h3 className="font-medium">Cobros registrados sin conexión</h3>
        {takings.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Ningún cobro de este turno se registró sin conexión.
          </p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Ninguna terminal los confirmó: revísalos antes de cerrar.
            </p>
            <ul className="divide-y rounded-md border">
              {takings.map((taking) => (
                <li key={taking.id} className="flex flex-wrap justify-between gap-2 p-2 text-sm">
                  <span>
                    {tenderLabel(taking.tender)}
                    {taking.reference ? ` · Ref. ${taking.reference}` : ""}
                    {" · "}
                    {formatSaleTime(new Date(taking.saleTime))}
                  </span>
                  <span className="tabular-nums">{formatCop(taking.amount)}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
