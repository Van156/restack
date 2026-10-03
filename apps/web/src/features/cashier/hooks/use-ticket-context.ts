import { authClient } from "@/app/auth-client";
import { useActingMember } from "@/features/acting-member";
import { formatNit, type LocationView } from "@/features/locations";

/** Who the contingency ticket names: the restaurant, the Location and the person charging. */
export function useTicketContext(location: LocationView) {
  const { data: organization } = authClient.useActiveOrganization();
  const { data: session } = authClient.useSession();
  const { acting } = useActingMember(location.id);
  return {
    restaurant: {
      name: organization?.name ?? location.name,
      ...(location.nit ? { nit: formatNit(location.nit) } : {}),
    },
    location: { name: location.name, ...(location.address ? { address: location.address } : {}) },
    cashier: acting?.name ?? session?.user.name,
  };
}
