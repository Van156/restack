import { useState } from "react";

import { CanGate } from "@/features/access-control";
import { LocationScope, type LocationView } from "@/features/locations";
import EmptyState from "@/shared/components/feedback/empty-state";
import Loader from "@/shared/components/feedback/loader";
import LoadError from "@/shared/components/feedback/load-error";
import PageHeader from "@/shared/components/layout/page-header";

import { useRuntime } from "@/shared/hooks/use-runtime";

import { useFloorFeed } from "../hooks/use-floor-feed";
import { useFloorLayout } from "../hooks/use-floor-queries";
import { buildFloorPlan } from "../lib/floor-plan";
import FloorPlanView from "./floor-plan-view";

/** Waiter surface (`order:take`): floor plan of the active Location. */
export default function WaiterPage() {
  return (
    <CanGate permission="order:take" message="No tienes permiso para tomar pedidos.">
      <PageHeader title="Mesas" description="Estado de las mesas de tu local." />
      <LocationScope>{(location) => <WaiterLocation location={location} />}</LocationScope>
    </CanGate>
  );
}

function WaiterLocation({ location }: { location: LocationView }) {
  const { areas, tables } = useFloorLayout(location.id);
  const feed = useFloorFeed(location.id);
  const { clock } = useRuntime();
  const [areaId, setAreaId] = useState("");

  if (areas.isPending || tables.isPending) {
    return <Loader />;
  }
  if (!areas.data || !tables.data) {
    return (
      <LoadError
        message="No pudimos cargar las mesas."
        onRetry={() => {
          void areas.refetch();
          void tables.refetch();
        }}
      />
    );
  }
  if (!feed.data) {
    return feed.error ? (
      <LoadError message="No pudimos cargar el estado de las mesas." />
    ) : (
      <Loader />
    );
  }
  if (areas.data.length === 0) {
    return (
      <EmptyState
        title="Este local aún no tiene mesas"
        description="Un administrador debe crear las áreas y mesas en Configuración."
      />
    );
  }
  const plan = buildFloorPlan({
    areas: areas.data,
    tables: tables.data,
    sessions: feed.data.sessions,
    calls: feed.data.calls,
    now: feed.receivedAt ?? clock.now(),
  });
  return <FloorPlanView areas={plan} areaId={areaId} onAreaChange={setAreaId} />;
}
