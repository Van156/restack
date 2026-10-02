/**
 * Social sign-in provider configuration (docs/specs/dashboard-shell-and-auth-ui.md
 * §6.3, R5.1). Only Google is supported. Pure functions so the startup
 * validation and the public enabled-providers list share one source of truth.
 */

export type SocialProviderEnv = {
  GOOGLE_CLIENT_ID?: string | undefined;
  GOOGLE_CLIENT_SECRET?: string | undefined;
};

export type SocialProviderId = "google";

/**
 * Returns Google's credentials when both are set, `null` when neither is, and
 * throws (startup failure) naming the missing variable when only one is.
 * Empty strings count as unset.
 */
export function resolveGoogleCredentials(
  env: SocialProviderEnv,
): { clientId: string; clientSecret: string } | null {
  const clientId = env.GOOGLE_CLIENT_ID || undefined;
  const clientSecret = env.GOOGLE_CLIENT_SECRET || undefined;
  if (clientId && clientSecret) {
    return { clientId, clientSecret };
  }
  if (clientId) {
    throw new Error("GOOGLE_CLIENT_ID is set but GOOGLE_CLIENT_SECRET is missing.");
  }
  if (clientSecret) {
    throw new Error("GOOGLE_CLIENT_SECRET is set but GOOGLE_CLIENT_ID is missing.");
  }
  return null;
}

/** Enabled provider ids (ids only, never credentials); derived from the same env `createAuth` uses. */
export function listEnabledSocialProviders(env: SocialProviderEnv): SocialProviderId[] {
  return resolveGoogleCredentials(env) ? ["google"] : [];
}
