import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

import { client } from "@/app/orpc";
import { useOfflineQueue } from "@/features/offline-queue";
import { isNetworkFailure } from "@/features/offline-queue";

/** "Voy" and "Atendido" for the Waiter calls; they need a connection and are not queued. */
export function useWaiterCallActions(actingToken?: string) {
  const { reportRequest } = useOfflineQueue();
  const options = {
    onSuccess: () => reportRequest("ok"),
    onError: (error: Error) => {
      reportRequest(isNetworkFailure(error) ? "network_failure" : "ok");
      toast.error(
        isNetworkFailure(error)
          ? "Sin conexión: la llamada se atiende cuando vuelva la conexión."
          : "No pudimos actualizar la llamada.",
      );
    },
  };
  const acknowledge = useMutation({
    mutationFn: (callId: string) =>
      client.restaurant.waiterCall.acknowledge({ callId, actingToken }),
    ...options,
  });
  const resolve = useMutation({
    mutationFn: (callId: string) => client.restaurant.waiterCall.resolve({ callId, actingToken }),
    ...options,
  });
  return {
    acknowledge: (callId: string) => acknowledge.mutate(callId),
    resolve: (callId: string) => resolve.mutate(callId),
    isPending: acknowledge.isPending || resolve.isPending,
  };
}
