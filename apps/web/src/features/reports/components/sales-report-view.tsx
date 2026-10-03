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

import type { SalesView } from "../lib/sales-view";

/** The day by tender with the tip on its own line, the DIAN documents of the day and a row per Location. */
export default function SalesReportView({ view }: { view: SalesView }) {
  return (
    <div className="space-y-6">
      <section aria-label="Ventas por forma de pago" className="space-y-2">
        <h3 className="font-medium">Ventas por forma de pago</h3>
        <p className="text-sm text-muted-foreground">
          {view.billCount} {view.billCount === 1 ? "cuenta cerrada" : "cuentas cerradas"}
        </p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Forma de pago</TableHead>
              <TableHead className="text-right">Cobros</TableHead>
              <TableHead className="text-right">Cobrado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {view.tenders.map((row) => (
              <TableRow key={row.tender}>
                <TableCell>{row.label}</TableCell>
                <TableCell className="text-right tabular-nums">{row.count}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCop(row.amount)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={2}>Ventas (sin propina)</TableCell>
              <TableCell className="text-right tabular-nums">
                {formatCop(view.salesTotal)}
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell colSpan={2}>Propinas (aparte)</TableCell>
              <TableCell className="text-right tabular-nums">{formatCop(view.tipTotal)}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell colSpan={2}>Total cobrado</TableCell>
              <TableCell className="text-right tabular-nums">
                {formatCop(view.collectedTotal)}
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </section>
      <section aria-label="Documentos electrónicos" className="space-y-2">
        <h3 className="font-medium">Documentos electrónicos del día</h3>
        <p className="text-sm text-muted-foreground">{view.documents.total} en total</p>
        <ul className="flex flex-wrap gap-4 text-sm">
          {view.documents.rows.map((row) => (
            <li key={row.status}>
              {row.label}: <span className="font-medium tabular-nums">{row.count}</span>
            </li>
          ))}
        </ul>
      </section>
      {view.locations.length > 1 ? (
        <section aria-label="Ventas por local" className="space-y-2">
          <h3 className="font-medium">Por local</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Local</TableHead>
                <TableHead className="text-right">Cuentas</TableHead>
                <TableHead className="text-right">Ventas</TableHead>
                <TableHead className="text-right">Propinas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {view.locations.map((row) => (
                <TableRow key={row.locationId}>
                  <TableCell>{row.name}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.billCount}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCop(row.salesTotal)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCop(row.tipTotal)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      ) : null}
    </div>
  );
}
