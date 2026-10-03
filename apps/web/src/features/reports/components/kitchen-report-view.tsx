import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@base-template/ui/components/table";

import type { KitchenRow, KitchenView } from "../lib/kitchen-view";

function TimingCells({ row }: { row: KitchenRow }) {
  return (
    <>
      <TableCell className="text-right tabular-nums">{row.ticketCount}</TableCell>
      <TableCell className="text-right tabular-nums">{row.completedCount}</TableCell>
      <TableCell className="text-right tabular-nums">
        {row.sentToReady.average} / {row.sentToReady.worst}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {row.preparation.average} / {row.preparation.worst}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {row.pickup.average} / {row.pickup.worst}
      </TableCell>
    </>
  );
}

/** Kitchen timing of the day: from the order sent to ready, preparation and the wait to pick it up (average / worst). */
export default function KitchenReportView({ view }: { view: KitchenView }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Local</TableHead>
          <TableHead className="text-right">Comandas</TableHead>
          <TableHead className="text-right">Entregadas</TableHead>
          <TableHead className="text-right">Enviada a lista</TableHead>
          <TableHead className="text-right">Preparación</TableHead>
          <TableHead className="text-right">Espera de recogida</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {view.locations.map((row) => (
          <TableRow key={row.locationId}>
            <TableCell>{row.name}</TableCell>
            <TimingCells row={row} />
          </TableRow>
        ))}
        {view.locations.length > 1 ? (
          <TableRow className="font-medium">
            <TableCell>Todos</TableCell>
            <TimingCells row={view.total} />
          </TableRow>
        ) : null}
      </TableBody>
    </Table>
  );
}
