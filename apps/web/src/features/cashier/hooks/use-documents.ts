import { useQuery } from "@tanstack/react-query";

import { authClient } from "@/app/auth-client";
import { client } from "@/app/orpc";

import { toDocumentView, type DocumentView } from "../lib/document-view";
import { cashierQueryKey } from "./cashier-query-key";

/** The documents of a charged Bill with their status; refreshed while one is still pending. */
export function useDocuments(sessionId: string, enabled: boolean) {
  const { data: organization } = authClient.useActiveOrganization();
  const query = useQuery({
    queryKey: cashierQueryKey(organization?.id, "documents", sessionId),
    queryFn: async (): Promise<DocumentView[]> =>
      (await client.restaurant.dian.getDocuments({ tableSessionId: sessionId })).map(
        toDocumentView,
      ),
    enabled: enabled && Boolean(organization?.id),
    refetchInterval: (state) =>
      state.state.data?.some((document) => document.status === "pending") ? 3000 : false,
    retry: false,
  });
  return {
    documents: query.data,
    isPending: query.isPending,
    isError: query.isError,
    refetch: () => void query.refetch(),
  };
}
