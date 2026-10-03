import { formatCop } from "@base-template/ui/lib/format-cop";
import { cn } from "@base-template/ui/lib/utils";

type OrderStripLineState = "unsent" | "sent" | "voided";

type OrderStripLine = {
  id: string;
  quantity: number;
  name: string;
  modifiers?: readonly string[];
  note?: string | null;
  state: OrderStripLineState;
  /** Line total in integer COP at the price recorded when the line was added. */
  total: number;
};

type OrderStripProps = {
  lines: readonly OrderStripLine[];
  className?: string;
};

const STATE_LABEL: Record<OrderStripLineState, string> = {
  unsent: "Sin enviar",
  sent: "Enviado",
  voided: "Anulado",
};

/** Lines of a Table session order with quantity, modifiers, note, send state and price. */
function OrderStrip({ lines, className }: OrderStripProps) {
  if (lines.length === 0) {
    return <p className="text-sm text-muted-foreground">Aún no hay productos en el pedido.</p>;
  }
  return (
    <ul
      data-slot="order-strip"
      className={cn("flex flex-col divide-y rounded-lg border", className)}
    >
      {lines.map((line) => (
        <li
          key={line.id}
          data-state={line.state}
          className="flex items-start justify-between gap-3 p-3 text-sm"
        >
          <div className={cn("flex flex-col gap-0.5", line.state === "voided" && "line-through")}>
            <span className="font-medium">
              {line.quantity} × {line.name}
            </span>
            {line.modifiers?.length ? (
              <span className="text-muted-foreground">{line.modifiers.join(", ")}</span>
            ) : null}
            {line.note ? <span className="text-muted-foreground italic">{line.note}</span> : null}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-0.5">
            <span className={cn("tabular-nums", line.state === "voided" && "line-through")}>
              {formatCop(line.total)}
            </span>
            <span
              className={cn(
                "text-xs",
                line.state === "voided" ? "text-destructive" : "text-muted-foreground",
              )}
            >
              {STATE_LABEL[line.state]}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}

export { OrderStrip };
export type { OrderStripLine, OrderStripLineState, OrderStripProps };
