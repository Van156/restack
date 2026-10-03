import { useActingOrderActions } from "../hooks/use-acting-order-actions";
import type { FloorTile } from "../lib/floor-plan";
import FreeTableView from "./free-table-view";

/** Container for a free Table: opens its session, online or queued under a session key. */
export default function FreeTablePage({
  locationId,
  tile,
  onBack,
}: {
  locationId: string;
  tile: FloorTile;
  onBack: () => void;
}) {
  const actions = useActingOrderActions(locationId);
  return (
    <FreeTableView
      tableName={tile.name}
      busy={actions.isPending}
      errorMessage={actions.errorMessage}
      onBack={onBack}
      onOpen={() =>
        void actions.run({ type: "open_session", tableId: tile.tableId, key: crypto.randomUUID() })
      }
    />
  );
}
