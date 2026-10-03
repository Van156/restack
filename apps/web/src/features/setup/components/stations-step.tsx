import Loader from "@/shared/components/feedback/loader";
import LoadError from "@/shared/components/feedback/load-error";

import { useRoomMutations } from "../hooks/use-room-mutations";
import { useStations } from "../hooks/use-setup-queries";
import NamedItemList from "./named-item-list";
import StationOutputNote from "./station-output-note";

/** Estaciones step: where Tickets are prepared (kitchen, bar). Output is the kitchen display. */
export default function StationsStep({ locationId }: { locationId: string }) {
  const stationsQuery = useStations(locationId);
  const { createStation, renameStation, deleteStation } = useRoomMutations();

  if (stationsQuery.isPending) {
    return <Loader />;
  }
  if (stationsQuery.isError) {
    return (
      <LoadError
        message="No pudimos cargar las estaciones."
        onRetry={() => stationsQuery.refetch()}
      />
    );
  }
  return (
    <NamedItemList
      label="Estaciones"
      items={stationsQuery.data.map((station) => ({
        id: station.id,
        name: station.name,
        detail: `${station.routedItemCount} platos enrutados`,
      }))}
      emptyMessage="Aún no hay estaciones. Crea, por ejemplo, «Cocina caliente», «Cocina fría» y «Bar»."
      addLabel="Nueva estación"
      isBusy={createStation.isPending || renameStation.isPending || deleteStation.isPending}
      describeDelete={(station) =>
        `Se eliminará la estación ${station.name}. No se puede si aún tiene platos enrutados.`
      }
      onAdd={(name) => createStation.mutateAsync({ locationId, name })}
      onRename={(stationId, name) => renameStation.mutateAsync({ stationId, name })}
      onDelete={(stationId) => deleteStation.mutateAsync({ stationId })}
    >
      <StationOutputNote />
    </NamedItemList>
  );
}
