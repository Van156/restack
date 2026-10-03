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

import { restaurantRoleLabel } from "../lib/role-labels";
import { rowActions, type StaffRow } from "../lib/staff-rows";

/** Staff with Role and Locations; Locales and PIN actions follow `rowActions`. */
export default function StaffTable({
  rows,
  callerIsOwner,
  onEditLocations,
  onResetPin,
}: {
  rows: readonly StaffRow[];
  callerIsOwner: boolean;
  onEditLocations: (row: StaffRow) => void;
  onResetPin: (row: StaffRow) => void;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Persona</TableHead>
          <TableHead>Rol</TableHead>
          <TableHead>Locales</TableHead>
          <TableHead className="text-right">Acciones</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => {
          const actions = rowActions({ callerIsOwner, row });
          const label = row.name || row.email || row.memberId;
          return (
            <TableRow key={row.memberId}>
              <TableCell>
                <p className="font-medium">{label}</p>
                {row.name && row.email ? (
                  <p className="text-sm text-muted-foreground">{row.email}</p>
                ) : null}
              </TableCell>
              <TableCell>{restaurantRoleLabel(row.role)}</TableCell>
              <TableCell>
                {row.isOwner ? (
                  <Badge variant="secondary">Todos los locales</Badge>
                ) : row.locationNames.length > 0 ? (
                  row.locationNames.join(", ")
                ) : (
                  <span className="text-muted-foreground">Sin locales</span>
                )}
              </TableCell>
              <TableCell className="space-x-2 text-right">
                {actions.canEditLocations ? (
                  <Button
                    size="sm"
                    variant="outline"
                    aria-label={`Editar locales de ${label}`}
                    onClick={() => onEditLocations(row)}
                  >
                    Locales
                  </Button>
                ) : null}
                {actions.canResetPin ? (
                  <Button
                    size="sm"
                    variant="outline"
                    aria-label={`Restablecer el PIN de ${label}`}
                    onClick={() => onResetPin(row)}
                  >
                    Restablecer PIN
                  </Button>
                ) : null}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
