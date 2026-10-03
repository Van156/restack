import { BellRingIcon, CircleCheckIcon } from "lucide-react";

import { formatAge } from "@base-template/ui/lib/format-age";
import { cn } from "@base-template/ui/lib/utils";

type FloorPlanTileState = "free" | "occupied" | "bill_requested";

type FloorPlanTileProps = {
  name: string;
  seats: number;
  state: FloorPlanTileState;
  /** A Station marked a Ticket of this Table ready for pickup. */
  hasReadyTicket?: boolean;
  /** Elapsed time of the open Waiter call, or null when there is none. */
  waiterCallAgeMs?: number | null;
  onSelect?: () => void;
  className?: string;
};

const STATE_LABEL: Record<FloorPlanTileState, string> = {
  free: "Libre",
  occupied: "Ocupada",
  bill_requested: "Cuenta solicitada",
};

const STATE_STYLE: Record<FloorPlanTileState, string> = {
  free: "border-border bg-card",
  occupied: "border-info bg-info/10",
  bill_requested: "border-warning bg-warning/15",
};

/** Table tile of the floor plan with its state, ready marker and Waiter call. */
function FloorPlanTile({
  name,
  seats,
  state,
  hasReadyTicket = false,
  waiterCallAgeMs = null,
  onSelect,
  className,
}: FloorPlanTileProps) {
  return (
    <button
      type="button"
      data-slot="floor-plan-tile"
      data-state={state}
      onClick={onSelect}
      className={cn(
        "flex min-h-24 min-w-32 flex-col items-start gap-1 rounded-lg border-2 p-3 text-left text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
        STATE_STYLE[state],
        className,
      )}
    >
      <span className="text-base font-medium">{name}</span>
      <span className="text-muted-foreground">{seats === 1 ? "1 puesto" : `${seats} puestos`}</span>
      <span className="font-medium">{STATE_LABEL[state]}</span>
      {hasReadyTicket ? (
        <span className="flex items-center gap-1 text-success">
          <CircleCheckIcon className="size-4" aria-hidden />
          Pedido listo
        </span>
      ) : null}
      {waiterCallAgeMs === null ? null : (
        <span className="flex items-center gap-1 text-info">
          <BellRingIcon className="size-4" aria-hidden />
          Llamado hace {formatAge(waiterCallAgeMs)}
        </span>
      )}
    </button>
  );
}

export { FloorPlanTile };
export type { FloorPlanTileProps, FloorPlanTileState };
