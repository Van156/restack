import { resolveTestDatabaseUrl } from "@base-template/auth/testing";
import * as schema from "@base-template/db/schema";
import { requireTestDatabaseOrSkip } from "@base-template/db/testing";
import { call } from "@orpc/server";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { asc, eq } from "drizzle-orm";

import { seedDianScenario } from "../../testing/dian-fixtures";
import { createRestaurantHarness } from "../../testing/restaurant-fixtures";
import type { RestaurantHarness } from "../../testing/restaurant-fixtures";
import { restaurantRouter } from "./index";

const reachable = await requireTestDatabaseOrSkip(
  resolveTestDatabaseUrl(),
  "restaurant sync kitchen",
);

const SYNC_AT = new Date("2026-10-03T15:00:00.000Z");
const MINUTE = 60_000;
const SOLD_AT = new Date("2026-10-01T18:00:00.000Z");
const at = (minutes: number) => new Date(SOLD_AT.getTime() + minutes * MINUTE);

type SyncRecord = {
  idempotencyKey: string;
  kind: string;
  payload: unknown;
  deviceRecordedAt: Date;
  actingToken?: string;
};

describe.skipIf(!reachable)("restaurant sync: send to kitchen", () => {
  let harness: RestaurantHarness;
  let scenario: Awaited<ReturnType<typeof seedDianScenario>>;

  beforeAll(async () => {
    harness = await createRestaurantHarness();
  });
  afterAll(async () => {
    await harness.close();
  });
  beforeEach(async () => {
    scenario = await seedDianScenario(harness);
    harness.clock.setNow(SYNC_AT);
  });

  const push = async (records: SyncRecord[], key: "waiterA" | "waiterB" = "waiterA") =>
    (await call(restaurantRouter.sync.push, { records }, { context: await scenario.as(key) }))
      .results;

  const open = (key: string, time = at(0)): SyncRecord => ({
    idempotencyKey: key,
    kind: "open_session",
    deviceRecordedAt: time,
    payload: { tableId: scenario.service.tables.t2 },
  });

  const lineFor = (
    key: string,
    sessionKey: string,
    item: "burger" | "beer" | "unrouted",
    time: Date,
  ): SyncRecord => ({
    idempotencyKey: key,
    kind: "order_line",
    deviceRecordedAt: time,
    payload: {
      sessionKey,
      menuItemId: scenario.service.items[item],
      quantity: 1,
      unitPrice: 6_000,
      modifiers:
        item === "burger" ? [{ modifierId: scenario.service.modifiers.medium, priceDelta: 0 }] : [],
    },
  });

  const send = (key: string, sessionKey: string, time: Date): SyncRecord => ({
    idempotencyKey: key,
    kind: "send_to_kitchen",
    deviceRecordedAt: time,
    payload: { sessionKey },
  });

  const tickets = () => harness.db.select().from(schema.ticket).orderBy(asc(schema.ticket.sentAt));

  test("a queued send makes one Ticket per Station stamped with the device time", async () => {
    const results = await push([
      open("open-1"),
      lineFor("l1", "open-1", "burger", at(1)),
      lineFor("l2", "open-1", "beer", at(2)),
      send("send-1", "open-1", at(3)),
    ]);

    expect(results.map((entry) => entry.status)).toEqual([
      "applied",
      "applied",
      "applied",
      "applied",
    ]);
    const stored = await tickets();
    expect(stored).toHaveLength(2);
    expect(stored.map((row) => row.stationId).sort()).toEqual(
      [scenario.service.stations.bar, scenario.service.stations.kitchen].sort(),
    );
    for (const row of stored) {
      expect(row.sentAt).toEqual(at(3));
      expect(row.sentByMemberId).toBe(scenario.seed.staff.waiterA.memberId);
    }
  });

  test("a send names the session by id too, and replaying its key changes nothing", async () => {
    const [opened] = await push([open("open-1"), lineFor("l1", "open-1", "beer", at(1))]);
    const record = {
      idempotencyKey: "send-1",
      kind: "send_to_kitchen",
      deviceRecordedAt: at(3),
      payload: { tableSessionId: opened!.entityId },
    };

    const [first] = await push([record]);
    const [replay] = await push([record]);

    expect(first!.status).toBe("applied");
    expect(replay!.status).toBe("already_applied");
    expect(await tickets()).toHaveLength(1);
  });

  test("queued sends keep queue order: later sends get later Tickets", async () => {
    await push([
      open("open-1"),
      lineFor("l1", "open-1", "beer", at(1)),
      send("send-1", "open-1", at(2)),
      lineFor("l2", "open-1", "beer", at(3)),
      send("send-2", "open-1", at(4)),
    ]);

    const stored = await tickets();
    expect(stored.map((row) => row.sentAt)).toEqual([at(2), at(4)]);
    const first = await harness.db
      .select()
      .from(schema.ticketLine)
      .where(eq(schema.ticketLine.ticketId, stored[0]!.id));
    expect(first).toHaveLength(1);
  });

  test("an unrouted item rejects the whole record with a clear reason and sends nothing", async () => {
    const results = await push([
      open("open-1"),
      lineFor("l1", "open-1", "beer", at(1)),
      lineFor("l2", "open-1", "unrouted", at(2)),
      send("send-1", "open-1", at(3)),
    ]);

    expect(results[3]).toMatchObject({
      status: "rejected",
      reason: { code: "CONFLICT", data: { reason: "unrouted_items", items: ["Sin cocina"] } },
    });
    expect(await tickets()).toHaveLength(0);
  });

  test("a send for a session not synced yet is retryable, and needs access to the Location", async () => {
    const [unknown] = await push([send("send-1", "never-opened", at(3))]);
    expect(unknown).toMatchObject({
      status: "rejected",
      reason: { data: { reason: "session_not_synced" } },
    });

    await push([open("open-1"), lineFor("l1", "open-1", "beer", at(1))]);
    const [foreign] = await push([send("send-2", "open-1", at(3))], "waiterB");
    expect(foreign).toMatchObject({ status: "rejected" });
    expect(await tickets()).toHaveLength(0);
  });

  test("the acting token attributes the Tickets to the member who switched in", async () => {
    const { actingToken } = await call(
      restaurantRouter.staff.switchIn,
      {
        locationId: scenario.seed.locations.a,
        memberId: scenario.seed.staff.cashierA.memberId,
        pin: "4821",
      },
      { context: await scenario.as("waiterA") },
    );
    await push([open("open-1"), lineFor("l1", "open-1", "beer", at(1))]);

    const [result] = await push([{ ...send("send-1", "open-1", at(3)), actingToken }]);

    expect(result!.status).toBe("applied");
    expect((await tickets())[0]!.sentByMemberId).toBe(scenario.seed.staff.cashierA.memberId);
  });
});
