import { OfflineBanner } from "@base-template/ui/components/offline-banner";
import { Tabs, TabsList, TabsTrigger } from "@base-template/ui/components/tabs";
import { useMemo, useState } from "react";

import { authClient } from "@/app/auth-client";
import { CanGate } from "@/features/access-control";
import { ActingBar, ActingMemberProvider } from "@/features/acting-member";
import { LocationScope, type LocationView } from "@/features/locations";
import { OfflineQueueProvider, useOfflineQueue } from "@/features/offline-queue";
import EmptyState from "@/shared/components/feedback/empty-state";
import Loader from "@/shared/components/feedback/loader";
import LoadError from "@/shared/components/feedback/load-error";
import PageHeader from "@/shared/components/layout/page-header";
import { useRuntime } from "@/shared/hooks/use-runtime";

import { useFloorFeed } from "../hooks/use-floor-feed";
import { useFloorLayout } from "../hooks/use-floor-queries";
import { buildFloorPlan } from "../lib/floor-plan";
import { overlayQueuedSessions } from "../lib/queued-view";
import type { WaiterSearch, WaiterView } from "../lib/waiter-search";
import { openCallCount } from "../lib/waiter-calls";
import FloorPlanView from "./floor-plan-view";
import PendingPanel from "./pending-panel";
import TableSessionPage from "./table-session-page";
import WaiterCallsPanel from "./waiter-calls-panel";

type PageProps = {
  search: WaiterSearch;
  onSearchChange: (search: WaiterSearch) => void;
};

const VIEWS = [
  { view: "mesas", label: "Mesas" },
  { view: "llamadas", label: "Llamadas" },
  { view: "pendientes", label: "Pendientes" },
] as const satisfies readonly { view: WaiterView; label: string }[];

/** Waiter surface (`order:take`): floor plan, Table sessions and the offline queue of the active Location. */
export default function WaiterPage({ search, onSearchChange }: PageProps) {
  return (
    <CanGate permission="order:take" message="No tienes permiso para tomar pedidos.">
      <PageHeader title="Mesas" description="Estado de las mesas de tu local." />
      <WaiterProviders>
        <LocationScope>
          {(location) => (
            <div className="space-y-4">
              <Connection />
              <ActingBar locationId={location.id} />
              <WaiterViews location={location} search={search} onSearchChange={onSearchChange} />
            </div>
          )}
        </LocationScope>
      </WaiterProviders>
    </CanGate>
  );
}

function WaiterProviders({ children }: { children: React.ReactNode }) {
  const { data: organization } = authClient.useActiveOrganization();
  if (!organization) {
    return <Loader />;
  }
  return (
    <OfflineQueueProvider organizationId={organization.id}>
      <ActingMemberProvider>{children}</ActingMemberProvider>
    </OfflineQueueProvider>
  );
}

/** The offline banner: silent while online. */
function Connection() {
  const { state } = useOfflineQueue();
  return state.online ? null : <OfflineBanner status={state} />;
}

function WaiterViews({ location, search, onSearchChange }: PageProps & { location: LocationView }) {
  const { records } = useOfflineQueue();
  const feed = useFloorFeed(location.id);
  const pending = records.filter((record) => record.status !== "synced").length;
  const calling = openCallCount(feed.calls);
  const counts = { mesas: 0, llamadas: calling, pendientes: pending };
  return (
    <div className="space-y-4">
      <Tabs
        value={search.view}
        onValueChange={(next) => onSearchChange({ view: next as WaiterView, table: undefined })}
      >
        <TabsList>
          {VIEWS.map(({ view, label }) => (
            <TabsTrigger key={view} value={view}>
              {label}
              {counts[view] > 0 ? ` (${counts[view]})` : ""}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      {search.view === "pendientes" ? (
        <PendingPanel locationId={location.id} />
      ) : search.view === "llamadas" ? (
        <WaiterCallsPanel
          locationId={location.id}
          calls={feed.calls}
          receivedAt={feed.receivedAt}
        />
      ) : (
        <FloorContent
          location={location}
          feed={feed}
          search={search}
          onSearchChange={onSearchChange}
        />
      )}
    </div>
  );
}

function FloorContent({
  location,
  feed,
  search,
  onSearchChange,
}: PageProps & { location: LocationView; feed: ReturnType<typeof useFloorFeed> }) {
  const { areas, tables, isPending, refetch } = useFloorLayout(location.id);
  const { records } = useOfflineQueue();
  const { clock } = useRuntime();
  const [areaId, setAreaId] = useState("");
  const sessions = useMemo(
    () => overlayQueuedSessions(feed.sessions ?? [], records),
    [feed.sessions, records],
  );

  if (isPending) {
    return <Loader />;
  }
  if (!areas || !tables) {
    return <LoadError message="No pudimos cargar las mesas." onRetry={refetch} />;
  }
  if (!feed.sessions) {
    return feed.error ? (
      <LoadError message="No pudimos cargar el estado de las mesas." />
    ) : (
      <Loader />
    );
  }
  if (areas.length === 0) {
    return (
      <EmptyState
        title="Este local aún no tiene mesas"
        description="Un administrador debe crear las áreas y mesas en Configuración."
      />
    );
  }
  const plan = buildFloorPlan({
    areas,
    tables,
    sessions,
    calls: feed.calls,
    now: feed.receivedAt ?? clock.now(),
  });
  const openTile = plan
    .flatMap((area) => area.tables)
    .find((tile) => tile.tableId === search.table);
  if (openTile) {
    return (
      <TableSessionPage
        locationId={location.id}
        tile={openTile}
        plan={plan}
        onBack={() => onSearchChange({ ...search, table: undefined })}
      />
    );
  }
  return (
    <FloorPlanView
      areas={plan}
      areaId={areaId}
      onAreaChange={setAreaId}
      onSelectTable={(tile) => onSearchChange({ ...search, table: tile.tableId })}
    />
  );
}
