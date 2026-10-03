import { FloorPlanTile } from "@base-template/ui/components/floor-plan-tile";

export type PreviewArea = {
  id: string;
  name: string;
  tables: { id: string; name: string; seats: number }[];
};

/** Live preview of the floor plan as Waiters will see it, plus the Station and Menu totals. */
export default function SetupPreview({
  areas,
  stationNames,
  menuItemCount,
}: {
  areas: readonly PreviewArea[];
  stationNames: readonly string[];
  menuItemCount: number;
}) {
  return (
    <aside aria-label="Vista previa" className="space-y-4 rounded-md border bg-muted/30 p-4">
      <h2 className="font-medium">Vista previa</h2>
      {areas.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Las áreas y mesas que crees aparecerán aquí como las verá el mesero.
        </p>
      ) : (
        areas.map((area) => (
          <section key={area.id} aria-label={area.name} className="space-y-2">
            <h3 className="text-sm font-medium">{area.name}</h3>
            {area.tables.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin mesas</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {area.tables.map((table) => (
                  <FloorPlanTile
                    key={table.id}
                    name={table.name}
                    seats={table.seats}
                    state="free"
                  />
                ))}
              </div>
            )}
          </section>
        ))
      )}
      <p className="text-sm text-muted-foreground">
        {stationNames.length === 0 ? "Sin estaciones" : `Estaciones: ${stationNames.join(", ")}`}
        {" · "}
        {menuItemCount} platos
      </p>
    </aside>
  );
}
