import { useQuery } from "@tanstack/react-query";

import { ENV } from "@/env.public";

import {
  fetchEnabledProviders,
  PROVIDERS_QUERY_RETRIES,
  providersRetryDelay,
  type SocialProviderId,
} from "../lib/social-providers";

/**
 * Enabled social providers from the public server endpoint (decision 17). Empty
 * while loading and while the query is failing, so the button is only ever shown
 * for a provider the server confirmed. A failed fetch is never cached as "none":
 * it retries with backoff, and only a successful answer is kept fresh for 5 minutes.
 */
export function useEnabledProviders(): SocialProviderId[] {
  const query = useQuery({
    queryKey: ["auth-providers"],
    queryFn: () => fetchEnabledProviders(ENV.VITE_SERVER_URL),
    staleTime: 5 * 60 * 1000,
    retry: PROVIDERS_QUERY_RETRIES,
    retryDelay: providersRetryDelay,
  });
  return query.data ?? [];
}
