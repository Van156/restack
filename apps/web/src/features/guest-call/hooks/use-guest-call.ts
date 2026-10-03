import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { ENV } from "@/env.public";

import { createGuestClient, type GuestReasonId, type GuestResponse } from "../lib/guest-client";
import { loadOrCreateGuestId } from "../lib/guest-id";
import { guestPollDelay, guestView, type GuestView } from "../lib/guest-view";
import { useNow } from "./use-now";

function browserStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * The guest page's data: polls the public state every few seconds (see `GUEST_POLL_MS`) and sends
 * the call. A failed refresh keeps the last answer; the guest id is created once per device.
 */
export function useGuestCall(token: string): {
  view: GuestView;
  call: (reason: GuestReasonId) => void;
  calling: boolean;
} {
  const queryClient = useQueryClient();
  const [guestId] = useState(() => loadOrCreateGuestId(browserStorage()));
  const [client] = useState(() => createGuestClient({ baseUrl: ENV.VITE_SERVER_URL, guestId }));
  const queryKey = ["guest-call", token] as const;

  const query = useQuery({
    queryKey,
    queryFn: async (): Promise<GuestResponse> => {
      const result = await client.getState(token);
      if (result.kind === "error") {
        throw new Error("The Waiter call page could not be refreshed.");
      }
      return result;
    },
    refetchInterval: (current) => guestPollDelay(current.state.data),
    refetchIntervalInBackground: false,
    retry: false,
    gcTime: 0,
    meta: { silent: true },
  });

  const mutation = useMutation({
    mutationFn: (reason: GuestReasonId) => client.call(token, reason),
    onSuccess: (result) => {
      if (result.kind !== "error") {
        queryClient.setQueryData(queryKey, result);
      }
    },
  });

  const last = query.data ?? null;
  const counting =
    last !== null &&
    (last.kind === "throttled" || last.kind === "state" || last.kind === "refused");
  const now = useNow(counting);
  const view = guestView({
    last,
    receivedAt: new Date(query.dataUpdatedAt || now.getTime()),
    now,
    refreshFailed: query.isError || mutation.data?.kind === "error",
  });
  return { view, call: (reason) => mutation.mutate(reason), calling: mutation.isPending };
}
