import { createHash } from "node:crypto";

import type { Clock } from "@base-template/api/context";
import type { DbExecutor } from "@base-template/api/lib/executor";
import type { RateLimitRule, RateLimiter } from "@base-template/api/lib/rate-limit";
import { verifyTableSessionToken } from "@base-template/api/lib/table-session-token";
import { createGuestCall, getGuestState } from "@base-template/api/lib/waiter-call-guest";
import { extractRequestMeta } from "@base-template/auth/audit";
import { WAITER_CALL_REASONS } from "@base-template/db/schema/restaurant-waiter-call";
import { Hono } from "hono";
import type { Context } from "hono";
import { z } from "zod";

export type WaiterCallRouteDeps = {
  db: DbExecutor;
  clock: Clock;
  secret: string;
  rateLimiter: RateLimiter;
};

const MINUTE_MS = 60 * 1000;
/**
 * Limits per fixed window. Sources are generous because a whole restaurant shares one address
 * and a guest page polls about once a second. See docs/architecture/restaurant.md#waiter-call.
 */
const LIMITS = {
  readPerSource: { limit: 600, windowMs: MINUTE_MS },
  readPerToken: { limit: 120, windowMs: MINUTE_MS },
  callPerSource: { limit: 30, windowMs: MINUTE_MS },
  callPerToken: { limit: 6, windowMs: MINUTE_MS },
} satisfies Record<string, RateLimitRule>;

const MAX_TOKEN_LENGTH = 1024;
const bodySchema = z.object({ reason: z.enum(WAITER_CALL_REASONS) });

function sourceOf(headers: Headers): string {
  return extractRequestMeta(headers).ip ?? "unknown";
}

/** Opaque, one-way identifier of the guest's source; the address itself is never stored. */
function fingerprintOf(headers: Headers): string {
  return createHash("sha256")
    .update(`${sourceOf(headers)}|${headers.get("user-agent") ?? ""}`)
    .digest("hex")
    .slice(0, 32);
}

const tokenKey = (token: string) => createHash("sha256").update(token).digest("hex");

/**
 * The guest Waiter call (`/api/public/waiter-call`): read the state and create a call, both by
 * Table session token, with no auth session. It answers only the call function.
 */
export function createWaiterCallRoutes(deps: WaiterCallRouteDeps) {
  const routes = new Hono();
  const guestDeps = { db: deps.db, clock: deps.clock, secret: deps.secret };

  const throttled = (c: Context) => {
    c.header("Retry-After", "60");
    return c.json({ status: "throttled" }, 429);
  };
  /** Signature and expiry only, no database: throttling a token needs it to be a real one. */
  const isGenuine = (token: string) =>
    token.length <= MAX_TOKEN_LENGTH &&
    verifyTableSessionToken(deps.secret, token, deps.clock.now()).ok;
  const invalid = (c: Context) => c.json({ status: "invalid" }, 404);

  routes.use("*", async (c, next) => {
    c.header("Cache-Control", "no-store");
    await next();
  });

  routes.get("/:token", async (c) => {
    const token = c.req.param("token");
    const source = sourceOf(c.req.raw.headers);
    if (!deps.rateLimiter.hit(`waiter-call:read:source:${source}`, LIMITS.readPerSource)) {
      return throttled(c);
    }
    if (!isGenuine(token)) {
      return invalid(c);
    }
    if (!deps.rateLimiter.hit(`waiter-call:read:token:${tokenKey(token)}`, LIMITS.readPerToken)) {
      return throttled(c);
    }
    const result = await getGuestState(guestDeps, token);
    return result.kind === "invalid" ? invalid(c) : c.json(result.state);
  });

  routes.post("/:token", async (c) => {
    const token = c.req.param("token");
    const headers = c.req.raw.headers;
    if (
      !deps.rateLimiter.hit(`waiter-call:call:source:${sourceOf(headers)}`, LIMITS.callPerSource)
    ) {
      return throttled(c);
    }
    if (!isGenuine(token)) {
      return invalid(c);
    }
    if (!deps.rateLimiter.hit(`waiter-call:call:token:${tokenKey(token)}`, LIMITS.callPerToken)) {
      return throttled(c);
    }
    const body = bodySchema.safeParse(await c.req.json().catch(() => null));
    if (!body.success) {
      return c.json({ status: "bad_request" }, 400);
    }
    const result = await createGuestCall(guestDeps, token, {
      reason: body.data.reason,
      fingerprint: fingerprintOf(headers),
    });
    if (result.kind === "invalid") {
      return invalid(c);
    }
    if (result.kind === "created") {
      return c.json(result.state, 201);
    }
    return c.json(
      {
        status: result.reason,
        ...(result.reason === "cooldown" ? { retryAfterSeconds: result.retryAfterSeconds } : {}),
        state: result.state,
      },
      409,
    );
  });

  return routes;
}
