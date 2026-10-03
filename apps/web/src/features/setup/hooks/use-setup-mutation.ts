import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { authClient } from "@/app/auth-client";

import { setupQueryKey } from "./use-setup-queries";

/** A setup write: toasts the server's message on failure and refreshes every setup query. */
export function useSetupMutation<TInput, TOutput>(
  mutationFn: (input: TInput) => Promise<TOutput>,
  successMessage?: string,
) {
  const queryClient = useQueryClient();
  const { data: organization } = authClient.useActiveOrganization();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      if (successMessage) {
        toast.success(successMessage);
      }
      return queryClient.invalidateQueries({ queryKey: setupQueryKey(organization?.id) });
    },
    onError: (error) => toast.error(error.message),
  });
}
