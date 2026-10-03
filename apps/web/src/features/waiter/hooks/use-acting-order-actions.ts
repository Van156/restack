import { useActingMember } from "@/features/acting-member";

import { useOrderActions } from "./use-order-actions";

/** `useOrderActions` attributed to whoever switched in at the Location, by token or offline PIN. */
export function useActingOrderActions(locationId: string) {
  const { actingToken, signer } = useActingMember(locationId);
  return useOrderActions(locationId, { token: actingToken, signer });
}
