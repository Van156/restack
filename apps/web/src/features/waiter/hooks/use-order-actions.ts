import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { authClient } from "@/app/auth-client";
import { client } from "@/app/orpc";
import { useOfflineQueue, type RecordActor } from "@/features/offline-queue";
import { useRuntime } from "@/shared/hooks/use-runtime";

import type { OrderAction } from "../lib/order-action";
import { describeOrderError } from "../lib/order-errors";
import { executeOrderAction } from "../lib/order-gateway";
import { waiterQueryKey } from "./use-floor-queries";

/**
 * Runs order actions for a Location online, or queues them when offline, and refreshes the
 * Waiter's data. A failure is kept as Spanish copy for the screen.
 */
export function useOrderActions(locationId: string, actor: RecordActor) {
  const queryClient = useQueryClient();
  const { data: organization } = authClient.useActiveOrganization();
  const offline = useOfflineQueue();
  const { clock } = useRuntime();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (action: OrderAction) =>
      executeOrderAction(
        {
          api: client.restaurant.orders,
          locationId,
          actor,
          clock,
          records: offline.records,
          online: offline.online,
          enqueue: offline.enqueue,
          onRequest: offline.reportRequest,
        },
        action,
      ),
    onMutate: () => setErrorMessage(null),
    onSuccess: (result) => {
      if (result === "queued") {
        toast.info("Sin conexión: guardado en este dispositivo. Se envía al volver la conexión.");
      }
    },
    onError: (error) => setErrorMessage(describeOrderError(error)),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: waiterQueryKey(organization?.id, "session") }),
  });

  return {
    run: (action: OrderAction) =>
      mutation.mutateAsync(action).then(
        () => true,
        () => false,
      ),
    isPending: mutation.isPending,
    errorMessage,
    clearError: () => setErrorMessage(null),
  };
}
