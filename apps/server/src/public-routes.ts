import { listEnabledSocialProviders } from "@base-template/auth/social-providers";
import type { SocialProviderEnv } from "@base-template/auth/social-providers";
import { Hono } from "hono";

/** Public routes (`/api/public`). Enabled providers: ids only, derived from the credentials `createAuth` uses (spec §6.3, decision 17). */
export function createPublicRoutes(env: SocialProviderEnv) {
  const routes = new Hono();
  routes.get("/auth-providers", (c) => {
    c.header("Cache-Control", "no-store");
    return c.json({ providers: listEnabledSocialProviders(env) });
  });
  return routes;
}
