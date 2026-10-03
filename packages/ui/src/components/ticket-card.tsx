import { Button } from "@base-template/ui/components/button";
import { StatusBadge } from "@base-template/ui/components/status-badge";
import { formatAge } from "@base-template/ui/lib/format-age";
import type { StatusOf } from "@base-template/ui/lib/status-labels";
import { cn } from "@base-template/ui/lib/utils";

type TicketCardLine = {
  id: string;
  quantity: number;
  name: string;
  modifiers?: readonly string[];
  note?: string | null;
  voided?: boolean;
};

type TicketCardTiming = {
  label: string;
  ms: number;
  /** The step has not ended yet, so the time is still counting. */
  running?: boolean;
};

type TicketCardProps = {
  station: string;
  table: string;
  waiter?: string | null;
  status: StatusOf<"ticket">;
  /** Time since the Ticket was sent, as measured by the server. */
  ageMs: number;
  lines: readonly TicketCardLine[];
  /** Measured steps, for example preparation time and pickup wait. */
  timings?: readonly TicketCardTiming[];
  /** Label of the one-tap action that moves the Ticket forward; omitted for the last status. */
  advanceLabel?: string;
  onAdvance?: () => void;
  className?: string;
};

/**
 * Kitchen card for a Ticket: Station, Table, lines (voids flagged), status, age since sent and,
 * when given, the time each step took.
 */
function TicketCard({
  station,
  table,
  waiter,
  status,
  ageMs,
  lines,
  timings,
  advanceLabel,
  onAdvance,
  className,
}: TicketCardProps) {
  return (
    <article
      data-slot="ticket-card"
      data-status={status}
      aria-label={`Comanda de ${table}`}
      className={cn("flex flex-col gap-3 rounded-lg border bg-card p-4 text-sm", className)}
    >
      <header className="flex items-start justify-between gap-2">
        <div className="flex flex-col">
          <span className="text-lg font-semibold">{table}</span>
          <span className="text-muted-foreground">
            {station}
            {waiter ? ` · ${waiter}` : ""}
          </span>
        </div>
        <div className="flex flex-col items-end gap-1">
          <StatusBadge kind="ticket" status={status} />
          <span className="text-muted-foreground tabular-nums">{formatAge(ageMs)}</span>
        </div>
      </header>
      {timings?.length ? (
        <dl className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
          {timings.map((timing) => (
            <div key={timing.label} className="flex gap-1">
              <dt>{timing.label}</dt>
              <dd className="tabular-nums">
                {formatAge(timing.ms)}
                {timing.running ? " (en curso)" : ""}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
      <ul className="flex flex-col gap-2">
        {lines.map((line) => (
          <li
            key={line.id}
            data-voided={line.voided ? "true" : undefined}
            className="flex flex-col"
          >
            <span className={cn("font-medium", line.voided && "text-destructive line-through")}>
              {line.quantity} × {line.name}
              {line.voided ? <span className="sr-only"> (anulado)</span> : null}
            </span>
            {line.voided ? (
              <span className="text-xs font-medium text-destructive">Anulado, no preparar</span>
            ) : null}
            {line.modifiers?.length ? (
              <span className="text-muted-foreground">{line.modifiers.join(", ")}</span>
            ) : null}
            {line.note ? <span className="text-muted-foreground italic">{line.note}</span> : null}
          </li>
        ))}
      </ul>
      {advanceLabel ? (
        <Button type="button" onClick={onAdvance}>
          {advanceLabel}
        </Button>
      ) : null}
    </article>
  );
}

export { TicketCard };
export type { TicketCardLine, TicketCardProps, TicketCardTiming };
