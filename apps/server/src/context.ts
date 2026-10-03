import { systemClock } from "@base-template/api/clock";
import { deviceFromHeaders } from "@base-template/api/lib/device-auth";
import { createRateLimiter } from "@base-template/api/lib/rate-limit";
import type { Context as ApiContext } from "@base-template/api/context";
import type { Context as HonoContext } from "hono";

import { ENV } from "./env.server";
import { auditLogger, auth, authorization, db, platformAdmin } from "./services";

const rateLimiter = createRateLimiter(systemClock);

export type CreateContextOptions = {
  context: HonoContext;
};

export async function createContext({ context }: CreateContextOptions): Promise<ApiContext> {
  const headers = context.req.raw.headers;
  const session = await auth.api.getSession({ headers });
  return {
    db,
    session,
    headers,
    authorization,
    platformAdmin,
    auditLogger,
    defaultMaxOrganizationsPerUser: ENV.DEFAULT_MAX_ORGS_PER_USER,
    clock: systemClock,
    actingTokenSecret: ENV.BETTER_AUTH_SECRET,
    rateLimiter,
    device: await deviceFromHeaders(db, systemClock, headers),
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
