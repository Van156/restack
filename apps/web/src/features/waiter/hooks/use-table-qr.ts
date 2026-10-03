import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { authClient } from "@/app/auth-client";
import { client } from "@/app/orpc";
import { isNetworkFailure, useOfflineQueue } from "@/features/offline-queue";

import { waiterQueryKey } from "./use-floor-queries";

/** The Table session QR token and its regeneration; both need a connection and are never queued. */
export function useTableQr(sessionId: string) {
  const { data: organization } = authClient.useActiveOrganization();
  const queryClient = useQueryClient();
  const { reportRequest } = useOfflineQueue();
  const queryKey = waiterQueryKey(organization?.id, "table-qr", sessionId);
  const query = useQuery({
    queryKey,
    queryFn: () => client.restaurant.waiterCall.qr({ tableSessionId: sessionId }),
    enabled: Boolean(organization?.id),
    gcTime: 0,
    retry: false,
  });
  const regenerate = useMutation({
    mutationFn: () => client.restaurant.waiterCall.regenerateQr({ tableSessionId: sessionId }),
    onSuccess: (qr) => {
      reportRequest("ok");
      queryClient.setQueryData(queryKey, qr);
    },
    onError: (error) => reportRequest(isNetworkFailure(error) ? "network_failure" : "ok"),
  });
  return {
    qr: regenerate.data ?? query.data,
    error: regenerate.error ?? query.error,
    isPending: query.isPending || regenerate.isPending,
    regenerate: () =>
      regenerate.mutateAsync().then(
        () => undefined,
        () => undefined,
      ),
  };
}
