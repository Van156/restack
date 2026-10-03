import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { authClient } from "@/app/auth-client";
import { client } from "@/app/orpc";
import { orgQueryKey } from "@/shared/lib/org-query-key";

import type { Plan } from "../lib/plan-view";

function plansKey(organizationId: string | undefined, ...parts: readonly unknown[]) {
  return orgQueryKey(organizationId, "plans", ...parts);
}

/** Plan, trial and DIAN gate of every Location, plus the documents issued this month. */
export function usePlans() {
  const { data: organization } = authClient.useActiveOrganization();
  return useQuery({
    queryKey: plansKey(organization?.id, "list"),
    queryFn: async () => {
      const [plans, counts] = await Promise.all([
        client.restaurant.plan.list(),
        client.restaurant.plan.documentCounts({}),
      ]);
      return { plans, counts };
    },
    enabled: Boolean(organization?.id),
    retry: false,
  });
}

/** Changes the Plan of one Location and refreshes the list. */
export function useChangePlan() {
  const queryClient = useQueryClient();
  const { data: organization } = authClient.useActiveOrganization();
  return useMutation({
    mutationFn: (input: { locationId: string; plan: Plan }) => client.restaurant.plan.set(input),
    onSuccess: () => {
      toast.success("Plan actualizado");
      return queryClient.invalidateQueries({ queryKey: plansKey(organization?.id) });
    },
    onError: (error: Error) => toast.error(error.message),
  });
}
