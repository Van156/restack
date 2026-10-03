import { resolveTestDatabaseUrl } from "@base-template/auth/testing";
import * as schema from "@base-template/db/schema";
import { requireTestDatabaseOrSkip } from "@base-template/db/testing";
import { call } from "@orpc/server";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { and, eq } from "drizzle-orm";

import { seedDianScenario } from "../../testing/dian-fixtures";
import { offlineActorFor, openOffline } from "../../testing/offline-client";
import type { OfflineMaterial } from "../../testing/offline-client";
import { createRestaurantHarness } from "../../testing/restaurant-fixtures";
import type { RestaurantHarness } from "../../testing/restaurant-fixtures";
import { restaurantRouter } from "./index";

const reachable = await requireTestDatabaseOrSkip(
  resolveTestDatabaseUrl(),
  "restaurant sync offline actor",
);

const SYNC_AT = new Date("2026-10-03T15:00:00.000Z");
const HOUR = 60 * 60_000;
const SOLD_AT = new Date(SYNC_AT.getTime() - 5 * HOUR);

type SyncRecord = {
  idempotencyKey: string;
  kind: string;
  payload: unknown;
  deviceRecordedAt: Date;
  actingToken?: string;
  offlineActor?: { memberId: string; epoch: number; mac: string };
};

describe.skipIf(!reachable)("restaurant sync: offline actor (PIN entered offline)", () => {
  let harness: RestaurantHarness;
  let scenario: Awaited<ReturnType<typeof seedDianScenario>>;
  let sessionId: string;

  beforeAll(async () => {
    harness = await createRestaurantHarness();
  });
  afterAll(async () => {
    await harness.close();
  });
  beforeEach(async () => {
    scenario = await seedDianScenario(harness);
    harness.clock.setNow(SYNC_AT);
    sessionId = await scenario.openSession({ lines: [] });
  });

  const scope = () => ({
    organizationId: scenario.seed.organizationId,
    locationId: scenario.seed.locations.a,
  });

  /** Material fetched online by the shared device's login, as the device holds it. */
  async function material(
    fetchedBy: Parameters<typeof scenario.as>[0] = "cashierA",
  ): Promise<OfflineMaterial[]> {
    return (
      await call(
        restaurantRouter.staff.offlineCredentials,
        { locationId: scope().locationId },
        { context: await scenario.as(fetchedBy) },
      )
    ).members;
  }

  const waiterOf = (all: OfflineMaterial[]) =>
    all.find((entry) => entry.memberId === scenario.seed.staff.waiterA.memberId)!;

  /** A beer line the device recorded after the waiter entered the PIN offline. */
  function signedLine(
    all: OfflineMaterial[],
    key: string,
    options: { pin?: string; at?: Date; extra?: Partial<SyncRecord> } = {},
  ): SyncRecord {
    const entry = waiterOf(all);
    const record = {
      idempotencyKey: key,
      kind: "order_line",
      deviceRecordedAt: options.at ?? SOLD_AT,
      payload: {
        tableSessionId: sessionId,
        menuItemId: scenario.service.items.beer,
        quantity: 1,
        unitPrice: 6_000,
      },
    };
    const offlineKey = openOffline(entry, options.pin ?? "4821", scope())!;
    return {
      ...record,
      offlineActor: offlineActorFor(entry, offlineKey, record),
      ...options.extra,
    };
  }

  const push = async (records: SyncRecord[], key: Parameters<typeof scenario.as>[0] = "cashierA") =>
    (await call(restaurantRouter.sync.push, { records }, { context: await scenario.as(key) }))
      .results;

  const lines = () =>
    harness.db
      .select()
      .from(schema.orderLine)
      .where(eq(schema.orderLine.tableSessionId, sessionId));

  test("a record signed after a correct offline PIN is applied and attributed to that member", async () => {
    const all = await material();

    const [result] = await push([signedLine(all, "line-1")]);

    expect(result).toMatchObject({ status: "applied" });
    expect((await lines())[0]!.recordedByMemberId).toBe(scenario.seed.staff.waiterA.memberId);
  });

  test("replaying the record is already_applied", async () => {
    const record = signedLine(await material(), "line-1");
    await push([record]);
    const [replay] = await push([record]);
    expect(replay!.status).toBe("already_applied");
    expect(await lines()).toHaveLength(1);
  });

  test("a wrong mac is rejected and nothing is recorded", async () => {
    const all = await material();
    const record = signedLine(all, "line-1");
    const forged = { ...record, offlineActor: { ...record.offlineActor!, mac: "A".repeat(43) } };

    const [result] = await push([forged]);

    expect(result).toMatchObject({
      status: "rejected",
      reason: { code: "FORBIDDEN", data: { reason: "offline_actor_invalid" } },
    });
    expect(await lines()).toHaveLength(0);
  });

  test("a mac made with a wrong PIN's key is rejected: the device never held the real key", async () => {
    const all = await material();
    const entry = waiterOf(all);
    const record = signedLine(all, "line-1");
    const guessed = offlineActorFor(entry, Buffer.alloc(32, 1), record);

    const [result] = await push([{ ...record, offlineActor: guessed }]);

    expect(result).toMatchObject({ reason: { data: { reason: "offline_actor_invalid" } } });
  });

  test("a mac cannot be moved to another record (key, kind or time)", async () => {
    const all = await material();
    const signed = signedLine(all, "line-1");

    const results = await push([
      { ...signed, idempotencyKey: "line-2" },
      { ...signed, deviceRecordedAt: new Date(SOLD_AT.getTime() + 1) },
      { ...signed, kind: "send_to_kitchen", payload: { tableSessionId: sessionId } },
    ]);

    for (const result of results) {
      expect(result).toMatchObject({
        status: "rejected",
        reason: { data: { reason: "offline_actor_invalid" } },
      });
    }
  });

  test("a stale epoch after a PIN reset is rejected so the device knows to refresh", async () => {
    const record = signedLine(await material(), "line-1");
    await call(
      restaurantRouter.staff.resetPin,
      { memberId: scenario.seed.staff.waiterA.memberId, pin: "2468" },
      { context: await scenario.as("admin") },
    );

    const [result] = await push([record]);

    expect(result).toMatchObject({
      status: "rejected",
      reason: { code: "FORBIDDEN", data: { reason: "offline_actor_stale" } },
    });
    expect(await lines()).toHaveLength(0);
  });

  test("a member removed from the Location is rejected even without an epoch change", async () => {
    const record = signedLine(await material(), "line-1");
    await harness.db
      .delete(schema.staffLocationAssignment)
      .where(
        and(
          eq(schema.staffLocationAssignment.memberId, scenario.seed.staff.waiterA.memberId),
          eq(schema.staffLocationAssignment.locationId, scope().locationId),
        ),
      );

    const [result] = await push([record]);

    expect(result).toMatchObject({
      status: "rejected",
      reason: { data: { reason: "offline_actor_invalid" } },
    });
  });

  test("a record older than 48 hours is rejected", async () => {
    const old = new Date(SYNC_AT.getTime() - 49 * HOUR);
    const fresh = new Date(SYNC_AT.getTime() - 47 * HOUR);
    const all = await material();

    const results = await push([
      signedLine(all, "old", { at: old }),
      signedLine(all, "fresh", { at: fresh }),
    ]);

    expect(results[0]).toMatchObject({
      status: "rejected",
      reason: { code: "FORBIDDEN", data: { reason: "offline_actor_expired" } },
    });
    expect(results[1]).toMatchObject({ status: "applied" });
  });

  test("material fetched by another login does not verify (bound to the syncing session)", async () => {
    const record = signedLine(await material("cashierA"), "line-1");

    const [result] = await push([record], "admin");

    expect(result).toMatchObject({
      status: "rejected",
      reason: { data: { reason: "offline_actor_invalid" } },
    });
  });

  test("the attributed member still needs the permission of the record kind", async () => {
    const all = await material();
    const entry = waiterOf(all);
    const record = {
      idempotencyKey: "pay-1",
      kind: "payment",
      deviceRecordedAt: SOLD_AT,
      payload: { tableSessionId: sessionId, tender: "cash", amount: 1_000 },
    };
    const offlineKey = openOffline(entry, "4821", scope())!;

    const [result] = await push([
      { ...record, offlineActor: offlineActorFor(entry, offlineKey, record) },
    ]);

    expect(result).toMatchObject({ status: "rejected", reason: { code: "FORBIDDEN" } });
  });

  test("an acting token and an offline actor together are refused", async () => {
    const all = await material();
    const [result] = await push([signedLine(all, "line-1", { extra: { actingToken: "x" } })]);
    expect(result).toMatchObject({ status: "rejected", reason: { code: "BAD_REQUEST" } });
  });

  test("a record with no offline actor is still attributed to the session's member", async () => {
    const [result] = await push([
      {
        idempotencyKey: "line-1",
        kind: "order_line",
        deviceRecordedAt: SOLD_AT,
        payload: {
          tableSessionId: sessionId,
          menuItemId: scenario.service.items.beer,
          quantity: 1,
          unitPrice: 6_000,
        },
      },
    ]);
    expect(result!.status).toBe("applied");
    expect((await lines())[0]!.recordedByMemberId).toBe(scenario.seed.staff.cashierA.memberId);
  });

  test("an offline-attributed send to kitchen is attributed too", async () => {
    const all = await material();
    await push([signedLine(all, "line-1")]);
    const entry = waiterOf(all);
    const record = {
      idempotencyKey: "send-1",
      kind: "send_to_kitchen",
      deviceRecordedAt: new Date(SOLD_AT.getTime() + HOUR),
      payload: { tableSessionId: sessionId },
    };
    const offlineKey = openOffline(entry, "4821", scope())!;

    const [result] = await push([
      { ...record, offlineActor: offlineActorFor(entry, offlineKey, record) },
    ]);

    expect(result!.status).toBe("applied");
    const [ticket] = await harness.db.select().from(schema.ticket);
    expect(ticket!.sentByMemberId).toBe(scenario.seed.staff.waiterA.memberId);
  });
});
