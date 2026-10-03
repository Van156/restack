import type { FloorPlanArea, FloorTile } from "../lib/floor-plan";
import FreeTablePage from "./free-table-page";
import OpenTablePage from "./open-table-page";

/** One Table: a free Table is opened, an occupied one shows its order. */
export default function TableSessionPage({
  locationId,
  tile,
  plan,
  onBack,
}: {
  locationId: string;
  tile: FloorTile;
  plan: readonly FloorPlanArea[];
  onBack: () => void;
}) {
  return tile.session === null ? (
    <FreeTablePage locationId={locationId} tile={tile} onBack={onBack} />
  ) : (
    <OpenTablePage
      locationId={locationId}
      tile={tile}
      session={tile.session}
      plan={plan}
      onBack={onBack}
    />
  );
}
