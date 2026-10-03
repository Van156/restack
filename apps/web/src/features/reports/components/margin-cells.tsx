import { Badge } from "@base-template/ui/components/badge";
import { formatCop } from "@base-template/ui/lib/format-cop";

/** A margin figure with its percent, or a dash when there is none. */
export function MarginCell({ margin, percent }: { margin: number | null; percent: number | null }) {
  if (margin === null) {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <span className="tabular-nums">
      {formatCop(margin)}
      {percent === null ? "" : ` (${percent} %)`}
    </span>
  );
}

/** Flag for a cost or margin that leaves out sales whose Menu item has no cost. */
export function MissingCostBadge({ label = "Sin costo" }: { label?: string }) {
  return (
    <Badge variant="outline" className="border-amber-500 text-amber-700 dark:text-amber-400">
      {label}
    </Badge>
  );
}
