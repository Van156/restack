import { resolveTestDatabaseUrl } from "@base-template/auth/testing";
import * as schema from "@base-template/db/schema";
import { requireTestDatabaseOrSkip } from "@base-template/db/testing";
import { call, ORPCError } from "@orpc/server";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";

import { verifyTableSessionToken } from "../../lib/table-session-token";
import { seedService } from "../../testing/orders-fixtures";
import type { ServiceSeed } from "../../testing/orders-fixtures";
import {
  createRestaurantHarness,
  TEST_ACTING_TOKEN_SECRET,
} from "../../testing/restaurant-fixtures";
import type { RestaurantHarness, RestaurantSeed } from "../../testing/restaurant-fixtures";
import { restaurantRouter } from "./index";

const reachable = await requireTestDatabaseOrSkip(resolveTestDatabaseUrl(), "waiter call QR");

describe.skipIf(!reachable)("waiter call: Table session QR", () => {
  let harness: RestaurantHarness;
  let seed: RestaurantSeed;
  let service: ServiceSeed;
  let sessionId: string;

  beforeAll(async () => {
    harness = await createRestaurantHarness();
  });
  afterAll(async () => {
    await harness.close();
  });
  beforeEach(async () => {
    await harness.reset();
    seed = await harness.seedRestaurant();
    service = await seedService(harness, seed);
    const session = await call(
      restaurantRouter.orders.openSession,
      { locationId: seed.locations.a, tableId: service.tables.t1 },
      { context: await as("waiterA") },
    );
    sessionId = session.id;
  });

  const as = (key: keyof RestaurantSeed["staff"]) =>
    harness.contextFor(seed.staff[key].userId, seed.organizationId);

  async function codeOf(promise: Promise<unknown>): Promise<string | undefined> {
    try {
      await promise;
    } catch (error) {
      return error instanceof ORPCError ? error.code : "NOT_AN_ORPC_ERROR";
    }
    return undefined;
  }

  const qr = async (key: keyof RestaurantSeed["staff"]) =>
    call(restaurantRouter.waiterCall.qr, { tableSessionId: sessionId }, { context: await as(key) });
  const regenerate = async (key: keyof RestaurantSeed["staff"]) =>
    call(
      restaurantRouter.waiterCall.regenerateQr,
      { tableSessionId: sessionId },
      { context: await as(key) },
    );

  test("a Waiter shows the QR: a signed token bound to the Location and session, plus the short code", async () => {
    const result = await qr("waiterA");
    const [session] = await harness.db
      .select()
      .from(schema.tableSession)
      .where(eq(schema.tableSession.id, sessionId));
    expect(result.shortCode).toBe(session!.shortCode);
    const verdict = verifyTableSessionToken(
      TEST_ACTING_TOKEN_SECRET,
      result.token,
      harness.clock.now(),
    );
    expect(verdict).toMatchObject({
      ok: true,
      claims: {
        organizationId: seed.organizationId,
        locationId: seed.locations.a,
        tableSessionId: sessionId,
        version: 1,
      },
    });
    expect(result.expiresAt.getTime()).toBeGreaterThan(harness.clock.now().getTime());
  });

  test("Staff of another Location are refused and nothing is minted", async () => {
    expect(await codeOf(qr("waiterB"))).toBe("FORBIDDEN");
  });

  test("a settled session has no QR", async () => {
    await harness.db
      .update(schema.tableSession)
      .set({ status: "settled", settledAt: harness.clock.now() })
      .where(eq(schema.tableSession.id, sessionId));
    expect(await codeOf(qr("waiterA"))).toBe("CONFLICT");
    expect(await codeOf(regenerate("waiterA"))).toBe("CONFLICT");
  });

  test("regenerating bumps the version, so the old QR stops matching and the new one works", async () => {
    const before = await qr("waiterA");
    const after = await regenerate("waiterA");
    const [session] = await harness.db
      .select()
      .from(schema.tableSession)
      .where(eq(schema.tableSession.id, sessionId));
    expect(session!.tokenVersion).toBe(2);
    expect(after.shortCode).toBe(session!.shortCode);
    const now = harness.clock.now();
    const oldVerdict = verifyTableSessionToken(TEST_ACTING_TOKEN_SECRET, before.token, now);
    const newVerdict = verifyTableSessionToken(TEST_ACTING_TOKEN_SECRET, after.token, now);
    expect(oldVerdict.ok && oldVerdict.claims.version).toBe(1);
    expect(newVerdict.ok && newVerdict.claims.version).toBe(2);
    expect((await qr("waiterA")).token).not.toBe(before.token);
  });

  test("regeneration is audited as waiter_call.qr_regenerated with the actor and the new version", async () => {
    await regenerate("waiterA");
    const rows = await harness.db
      .select()
      .from(schema.auditLog)
      .where(eq(schema.auditLog.action, "waiter_call.qr_regenerated"));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      organizationId: seed.organizationId,
      actorUserId: seed.staff.waiterA.userId,
      targetType: "table_session",
      targetId: sessionId,
    });
    expect(rows[0]!.metadata).toMatchObject({ version: 2 });
  });

  test("a refused regeneration changes nothing and audits nothing", async () => {
    expect(await codeOf(regenerate("waiterB"))).toBe("FORBIDDEN");
    const [session] = await harness.db
      .select()
      .from(schema.tableSession)
      .where(eq(schema.tableSession.id, sessionId));
    expect(session!.tokenVersion).toBe(1);
    expect(await harness.db.select().from(schema.auditLog)).toHaveLength(0);
  });
});
