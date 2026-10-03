import { CanGate } from "@/features/access-control";
import { LocationScope } from "@/features/locations";
import PageHeader from "@/shared/components/layout/page-header";

import { useStaffKitchenSource } from "../hooks/use-kitchen-sources";
import KitchenBoard from "./kitchen-board";

/** The same board for Staff with `order:take`, on the active Location (every Station there). */
export default function StaffKitchenPage() {
  return (
    <CanGate permission="order:take" message="No tienes permiso para ver la cocina.">
      <PageHeader title="Cocina" description="Comandas del local en tiempo real." />
      <LocationScope>{(location) => <StaffBoard locationId={location.id} />}</LocationScope>
    </CanGate>
  );
}

function StaffBoard({ locationId }: { locationId: string }) {
  const source = useStaffKitchenSource(locationId);
  return <KitchenBoard source={source} />;
}
