import { FloorPlanTile } from "@base-template/ui/components/floor-plan-tile";
import { Tabs, TabsList, TabsTrigger } from "@base-template/ui/components/tabs";

import type { FloorPlanArea, FloorTile } from "../lib/floor-plan";

/** Areas as tabs and the Tables of the chosen Area as tiles; `onSelectTable` opens one. */
export default function FloorPlanView({
  areas,
  areaId,
  onAreaChange,
  onSelectTable,
}: {
  areas: readonly FloorPlanArea[];
  areaId: string;
  onAreaChange: (areaId: string) => void;
  onSelectTable?: (tile: FloorTile) => void;
}) {
  const area = areas.find((candidate) => candidate.id === areaId) ?? areas[0];
  return (
    <div className="space-y-4">
      <Tabs value={area?.id ?? ""} onValueChange={(next) => onAreaChange(String(next))}>
        <TabsList className="flex-wrap">
          {areas.map((candidate) => (
            <TabsTrigger key={candidate.id} value={candidate.id}>
              {candidate.name}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      {area && area.tables.length === 0 ? (
        <p className="text-sm text-muted-foreground">Esta área aún no tiene mesas.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {area?.tables.map((tile) => (
            <li key={tile.tableId}>
              <FloorPlanTile
                name={tile.name}
                seats={tile.seats}
                state={tile.state}
                hasReadyTicket={tile.hasReadyTicket}
                waiterCallAgeMs={tile.waiterCallAgeMs}
                onSelect={onSelectTable ? () => onSelectTable(tile) : undefined}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
