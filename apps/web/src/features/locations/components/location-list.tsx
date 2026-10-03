import { Badge } from "@base-template/ui/components/badge";
import { Button } from "@base-template/ui/components/button";

import type { LocationView } from "../types";

/** Locations with their key settings; Edit appears only when `onEdit` is given. */
export default function LocationList({
  locations,
  onEdit,
}: {
  locations: readonly LocationView[];
  onEdit?: (location: LocationView) => void;
}) {
  return (
    <ul className="divide-y rounded-md border">
      {locations.map((location) => (
        <li key={location.id} className="flex flex-wrap items-center gap-3 p-3">
          <div className="min-w-0 flex-1">
            <p className="font-medium">{location.name}</p>
            {location.address ? (
              <p className="text-sm text-muted-foreground">{location.address}</p>
            ) : null}
            <p className="text-sm text-muted-foreground">
              Propina sugerida {location.suggestedTipPercent} %
              {location.waitersCanCharge ? " · Los meseros pueden cobrar" : ""}
            </p>
          </div>
          {location.isFranchise ? <Badge variant="secondary">Franquicia</Badge> : null}
          {location.active ? null : <Badge variant="outline">Inactivo</Badge>}
          {onEdit ? (
            <Button variant="outline" size="sm" onClick={() => onEdit(location)}>
              Editar
            </Button>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
