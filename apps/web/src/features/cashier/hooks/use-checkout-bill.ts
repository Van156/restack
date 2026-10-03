import { useQuery } from "@tanstack/react-query";

import { authClient } from "@/app/auth-client";
import { client } from "@/app/orpc";
import { isNetworkFailure, useOfflineQueue } from "@/features/offline-queue";
import { useCached } from "@/shared/hooks/use-cached";

import { toCheckoutBill, type CheckoutBill } from "../lib/checkout-bill";
import { cashierQueryKey } from "./cashier-query-key";
import { useCashierCache } from "./use-cashier-cache";

export const BILL_REFETCH_MS = 1000;

/**
 * The Bill of a session, refreshed every second like the floor plan. The last copy is kept so a
 * Bill seen online can still be charged offline.
 */
export function useCheckoutBill(locationId: string, sessionId: string) {
  const { data: organization } = authClient.useActiveOrganization();
  const { reportRequest } = useOfflineQueue();
  const cache = useCashierCache(locationId);
  const query = useQuery({
    queryKey: cashierQueryKey(organization?.id, "bill", sessionId),
    queryFn: async (): Promise<CheckoutBill> => {
      try {
        const bill = toCheckoutBill(
          await client.restaurant.billing.getBill({ tableSessionId: sessionId }),
        );
        reportRequest("ok");
        return bill;
      } catch (error) {
        reportRequest(isNetworkFailure(error) ? "network_failure" : "ok");
        throw error;
      }
    },
    enabled: Boolean(organization?.id),
    refetchInterval: BILL_REFETCH_MS,
    retry: false,
  });
  const bill = useCached(
    query.data,
    () => cache.readBill(sessionId),
    (value) => cache.writeBill(sessionId, value),
  );
  return {
    bill,
    isPending: query.isPending && !bill,
    refetch: () => void query.refetch(),
  };
}
