import Loader from "@/shared/components/feedback/loader";
import LoadError from "@/shared/components/feedback/load-error";

import { useRoomMutations } from "../hooks/use-room-mutations";
import { useAreas } from "../hooks/use-setup-queries";
import NamedItemList from "./named-item-list";

/** Áreas step: the zones of the room, such as the dining room or the terrace. */
export default function AreasStep({ locationId }: { locationId: string }) {
  const areasQuery = useAreas(locationId);
  const { createArea, renameArea, deleteArea } = useRoomMutations();

  if (areasQuery.isPending) {
    return <Loader />;
  }
  if (areasQuery.isError) {
    return (
      <LoadError message="No pudimos cargar las áreas." onRetry={() => areasQuery.refetch()} />
    );
  }
  return (
    <NamedItemList
      label="Áreas"
      items={areasQuery.data.map((area) => ({ id: area.id, name: area.name }))}
      emptyMessage="Aún no hay áreas. Crea, por ejemplo, «Salón» y «Terraza»."
      addLabel="Nueva área"
      isBusy={createArea.isPending || renameArea.isPending || deleteArea.isPending}
      describeDelete={(area) =>
        `Se eliminará el área ${area.name} junto con sus mesas. No se puede si tiene cuentas abiertas o historial.`
      }
      onAdd={(name) => createArea.mutateAsync({ locationId, name })}
      onRename={(areaId, name) => renameArea.mutateAsync({ areaId, name })}
      onDelete={(areaId) => deleteArea.mutateAsync({ areaId })}
    />
  );
}
