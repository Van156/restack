import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { authClient } from "@/app/auth-client";
import { client } from "@/app/orpc";

import { describeOrderError } from "../lib/order-errors";
import { runOnline, type OrderAction } from "../lib/order-action";
import { waiterQueryKey } from "./use-floor-queries";

/** Runs order actions for a Location and refreshes the Waiter's data; the failure is kept as copy. */
export function useOrderActions(locationId: string, actingToken?: string) {
  const queryClient = useQueryClient();
  const { data: organization } = authClient.useActiveOrganization();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (action: OrderAction) =>
      runOnline(client.restaurant.orders, locationId, action, actingToken),
    onMutate: () => setErrorMessage(null),
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
