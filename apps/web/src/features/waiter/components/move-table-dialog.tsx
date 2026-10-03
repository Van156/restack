import { Button } from "@base-template/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@base-template/ui/components/dialog";

import type { FloorPlanArea } from "../lib/floor-plan";

/** Lists the free Tables, by Area, to move a session to. */
export default function MoveTableDialog({
  areas,
  onMove,
  onCancel,
}: {
  areas: readonly FloorPlanArea[];
  onMove: (tableId: string) => void;
  onCancel: () => void;
}) {
  const withFree = areas
    .map((area) => ({ ...area, tables: area.tables.filter((tile) => tile.state === "free") }))
    .filter((area) => area.tables.length > 0);
  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onCancel())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mover a otra mesa</DialogTitle>
          <DialogDescription>Elige una mesa libre.</DialogDescription>
        </DialogHeader>
        {withFree.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay mesas libres.</p>
        ) : (
          <div className="space-y-3">
            {withFree.map((area) => (
              <section key={area.id} aria-label={area.name} className="space-y-2">
                <h3 className="text-sm font-medium">{area.name}</h3>
                <div className="flex flex-wrap gap-2">
                  {area.tables.map((tile) => (
                    <Button
                      key={tile.tableId}
                      type="button"
                      variant="outline"
                      onClick={() => onMove(tile.tableId)}
                    >
                      Mesa {tile.name}
                    </Button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
