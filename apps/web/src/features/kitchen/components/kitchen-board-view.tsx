import { Alert, AlertDescription } from "@base-template/ui/components/alert";
import { OfflineBanner } from "@base-template/ui/components/offline-banner";
import { TicketCard } from "@base-template/ui/components/ticket-card";
import { formatAge } from "@base-template/ui/lib/format-age";
import type { OfflineStatus } from "@base-template/ui/lib/offline-banner-state";

import type { BoardColumn, BoardMetrics, TicketStatus } from "../lib/board";

const OFFLINE_MESSAGE = "Pide las comandas en voz alta";

type KitchenBoardViewProps = {
  columns: readonly BoardColumn[];
  metrics: BoardMetrics;
  connection: OfflineStatus;
  /** Shown when the last advance failed. */
  advanceError?: string | null;
  onAdvance: (ticketId: string, status: Exclude<TicketStatus, "nuevo">) => void;
};

/**
 * Kitchen board: one column per Ticket status, big touch targets, and the figures the listed
 * Tickets allow. Advancing needs a connection, so offline the buttons are replaced by a notice.
 */
export default function KitchenBoardView({
  columns,
  metrics,
  connection,
  advanceError,
  onAdvance,
}: KitchenBoardViewProps) {
  const offline = !connection.online;
  return (
    <div className="flex flex-col gap-4">
      {offline ? (
        <>
          <OfflineBanner status={connection} offlineMessage={OFFLINE_MESSAGE} />
          <p className="text-sm text-muted-foreground">
            Sin conexión no se puede avanzar una comanda. Se muestra el último tablero recibido.
          </p>
        </>
      ) : null}
      {advanceError ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{advanceError}</AlertDescription>
        </Alert>
      ) : null}
      <dl
        aria-label="Resumen del tablero"
        className="flex flex-wrap gap-x-8 gap-y-2 rounded-lg border bg-card p-4 text-base"
      >
        <Figure label="Nuevas" value={String(metrics.nuevo)} />
        <Figure label="Preparando" value={String(metrics.preparando)} />
        <Figure label="Listas" value={String(metrics.listo)} />
        <Figure
          label="Más antigua sin empezar"
          value={metrics.oldestWaitingMs === null ? "—" : formatAge(metrics.oldestWaitingMs)}
        />
      </dl>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {columns.map((column) => (
          <section
            key={column.status}
            aria-label={column.label}
            className="flex min-h-48 flex-col gap-3 rounded-lg bg-muted/40 p-3"
          >
            <h2 className="text-lg font-semibold">
              {column.label} <span className="text-muted-foreground">({column.cards.length})</span>
            </h2>
            {column.cards.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin comandas.</p>
            ) : (
              column.cards.map((card) => {
                const { advance } = card;
                return (
                  <TicketCard
                    key={card.id}
                    station={card.stationName}
                    table={card.tableName}
                    waiter={card.waiter}
                    status={card.status}
                    ageMs={card.ageMs}
                    lines={card.lines}
                    advanceLabel={offline ? undefined : advance?.label}
                    onAdvance={advance ? () => onAdvance(card.id, advance.status) : undefined}
                    className="text-base [&_button]:h-14 [&_button]:text-lg"
                  />
                );
              })
            )}
          </section>
        ))}
      </div>
    </div>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-2xl font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
