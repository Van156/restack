/** Social providers the web app knows how to render (spec §6.3: Google only). */
export type SocialProviderId = "google";

const KNOWN_PROVIDERS: readonly SocialProviderId[] = ["google"];

export const SOCIAL_PROVIDER_LABELS: Record<SocialProviderId, string> = {
  google: "Google",
};

/**
 * Parses the public enabled-providers response (`{ "providers": ["google"] }`).
 * Anything malformed or unknown yields no providers, so the button stays hidden
 * (decision 17).
 */
export function parseEnabledProviders(body: unknown): SocialProviderId[] {
  const providers = (body as { providers?: unknown } | null | undefined)?.providers;
  if (!Array.isArray(providers)) {
    return [];
  }
  return KNOWN_PROVIDERS.filter((known) => providers.includes(known));
}

/** Path of the server's public enabled-providers endpoint. */
export const AUTH_PROVIDERS_PATH = "/api/public/auth-providers";

/** Retries for the providers query before the button stays hidden (decision 17). */
export const PROVIDERS_QUERY_RETRIES = 3;

/** Capped exponential backoff (1s, 2s, 4s, ... up to 10s) for the providers query. */
export function providersRetryDelay(attempt: number): number {
  return Math.min(1000 * 2 ** attempt, 10_000);
}

/**
 * Fetches enabled providers. Any failure (network, non-2xx, invalid JSON, malformed
 * body) REJECTS instead of resolving to `[]`, so the query retries and does not cache
 * the failure as "no providers"; the UI hides the button while unresolved or failed.
 */
export async function fetchEnabledProviders(
  serverUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<SocialProviderId[]> {
  const response = await fetchImpl(new URL(AUTH_PROVIDERS_PATH, serverUrl));
  if (!response.ok) {
    throw new Error(`Enabled providers request failed with status ${response.status}`);
  }
  const body: unknown = await response.json();
  if (!Array.isArray((body as { providers?: unknown } | null)?.providers)) {
    throw new Error("Enabled providers response was malformed");
  }
  return parseEnabledProviders(body);
}

/**
 * True when a `pageshow` event is a back/forward-cache restore (`persisted`). The
 * page then resumes with its old JS state, so a pending Google redirect the user
 * navigated back from must be reset or the buttons stay disabled.
 */
export function isBfcacheRestore(event: { persisted?: boolean }): boolean {
  return event.persisted === true;
}
