import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { authClient } from "@/app/auth-client";
import { client } from "@/app/orpc";

import { locationsQueryKey } from "./use-locations";

type CreateInput = Parameters<typeof client.restaurant.locations.create>[0];
type UpdateInput = Parameters<typeof client.restaurant.locations.update>[0];

/** Create and update Location mutations; both refresh the Location list. */
export function useLocationMutations() {
  const queryClient = useQueryClient();
  const { data: organization } = authClient.useActiveOrganization();
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: locationsQueryKey(organization?.id) });

  const createMutation = useMutation({
    mutationFn: (input: CreateInput) => client.restaurant.locations.create(input),
    onSuccess: () => {
      toast.success("Local creado");
      return refresh();
    },
    onError: (error) => toast.error(error.message),
  });

  const updateMutation = useMutation({
    mutationFn: (input: UpdateInput) => client.restaurant.locations.update(input),
    onSuccess: () => {
      toast.success("Local actualizado");
      return refresh();
    },
    onError: (error) => toast.error(error.message),
  });

  return { createMutation, updateMutation };
}
