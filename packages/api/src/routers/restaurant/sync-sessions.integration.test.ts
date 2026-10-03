import { resolveTestDatabaseUrl } from "@base-template/auth/testing";
import * as schema from "@base-template/db/schema";
import { requireTestDatabaseOrSkip } from "@base-template/db/testing";
import { call } from "@orpc/server";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";

import { seedDianScenario } from "../../testing/dian-fixtures";
import { createRestaurantHarness } from "../../testing/restaurant-fixtures";
import type { RestaurantHarness } from "../../testing/restaurant-fixtures";
import { restaurantRouter } from "./index";

const reachable = await requireTestDatabaseOrSkip(
  resolveTestDatabaseUrl(),
  "restaurant sync sessions",
);

/** The server clock when the batches below arrive: 2026-10-03 10:00 in Bogota. */
const SYNC_AT = new Date("2026-10-03T15:00:00.000Z");
const MINUTE = 60_000;
/** The offline service: 2026-10-01 13:00 in Bogota. */
const SOLD_AT = new Date("2026-10-01T18:00:00.000Z");
const at = (minutes: number) => new Date(SOLD_AT.getTime() + minutes * MINUTE);

type SyncRecord = {
  idempotencyKey: string;
  kind: string;
  payload: unknown;
  deviceRecordedAt: Date;
  actingToken?: string;
};

describe.skipIf(!reachable)("restaurant sync: Table sessions opened and moved offline", () => {
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

  type StaffKey = Parameters<typeof scenario.as>[0];

  const push = async (records: SyncRecord[], key: StaffKey = "waiterA") =>
    (await call(restaurantRouter.sync.push, { records }, { context: await scenario.as(key) }))
      .results;

  const tableId = (name: "t1" | "t2" | "t3" | "b1") => scenario.service.tables[name];

  const open = (key: string, table = tableId("t2"), time = at(0)): SyncRecord => ({
    idempotencyKey: key,
    kind: "open_session",
    deviceRecordedAt: time,
    payload: { tableId: table },
  });

  const lineFor = (key: string, sessionKey: string, time = at(5)): SyncRecord => ({
    idempotencyKey: key,
    kind: "order_line",
    deviceRecordedAt: time,
    payload: {
      sessionKey,
      menuItemId: scenario.service.items.beer,
      quantity: 1,
      unitPrice: 6_000,
    },
  });

  const move = (
    key: string,
    ref: { sessionKey?: string; tableSessionId?: string },
    table: string,
    time: Date,
  ): SyncRecord => ({
    idempotencyKey: key,
    kind: "move_session",
    deviceRecordedAt: time,
    payload: { ...ref, tableId: table },
  });

  const sessions = () => harness.db.select().from(schema.tableSession);
  const sessionOf = async (sessionKey: string) => {
    const [row] = await harness.db
      .select({ session: schema.tableSession })
      .from(schema.tableSessionKey)
      .innerJoin(
        schema.tableSession,
        eq(schema.tableSession.id, schema.tableSessionKey.tableSessionId),
      )
      .where(eq(schema.tableSessionKey.idempotencyKey, sessionKey));
    return row!.session;
  };

  describe("opening", () => {
    test("a Table session opened offline takes its lines, payment and settle from the same batch", async () => {
      const results = await push(
        [
          open("sess-1"),
          lineFor("line-1", "sess-1"),
          {
            idempotencyKey: "pay-1",
            kind: "payment",
            deviceRecordedAt: at(40),
            payload: { sessionKey: "sess-1", tender: "cash", amount: 6_000, settle: true },
          },
        ],
        "cashierA",
      );

      expect(results.map((entry) => entry.status)).toEqual(["applied", "applied", "applied"]);
      const session = await sessionOf("sess-1");
      expect(results[0]!.entityId).toBe(session.id);
      expect(session).toMatchObject({
        tableId: tableId("t2"),
        openedAt: at(0),
        status: "settled",
        settledAt: at(40),
      });
      expect(session.openedByMemberId).toBe(scenario.seed.staff.cashierA.memberId);
      const [stored] = await harness.db
        .select()
        .from(schema.orderLine)
        .where(eq(schema.orderLine.tableSessionId, session.id));
      expect(stored).toMatchObject({ unitPrice: 6_000, clientRecordedAt: at(5) });
    });

    test("lines of a later batch still find the session by its key", async () => {
      await push([open("sess-1")]);

      const [result] = await push([lineFor("line-1", "sess-1")]);

      expect(result!.status).toBe("applied");
    });

    test("a Waiter opens Tables offline with order:take", async () => {
      const [result] = await push([open("sess-1")], "waiterA");

      expect(result!.status).toBe("applied");
      expect(await sessions()).toHaveLength(1);
    });

    test("the session is attributed to the member of the acting token", async () => {
      harness.clock.setNow(at(0));
      const { actingToken } = await call(
        restaurantRouter.staff.switchIn,
        {
          locationId: scenario.seed.locations.a,
          memberId: scenario.seed.staff.waiterA.memberId,
          pin: "4821",
        },
        { context: await scenario.as("cashierA") },
      );
      harness.clock.setNow(SYNC_AT);

      const [result] = await push([{ ...open("sess-1", tableId("t2"), at(10)), actingToken }]);

      expect(result!.status).toBe("applied");
      expect((await sessionOf("sess-1")).openedByMemberId).toBe(
        scenario.seed.staff.waiterA.memberId,
      );
    });

    test("replaying the opening record reports already_applied and opens nothing more", async () => {
      await push([open("sess-1")]);

      const [replay] = await push([open("sess-1")]);

      expect(replay!.status).toBe("already_applied");
      expect(await sessions()).toHaveLength(1);
      expect(replay!.entityId).toBe((await sessionOf("sess-1")).id);
    });

    test("concurrent replays of the same opening record apply it once", async () => {
      const batches = await Promise.all([push([open("sess-1")]), push([open("sess-1")])]);

      expect(batches.map((results) => results[0]!.status).sort()).toEqual([
        "already_applied",
        "applied",
      ]);
      expect(await sessions()).toHaveLength(1);
    });

    test("opening a Table that already has an open session merges into it, so no line is lost", async () => {
      const existing = await scenario.openSession({ tableId: tableId("t2"), lines: [] });

      const results = await push([open("sess-1"), lineFor("line-1", "sess-1")]);

      expect(results[0]).toMatchObject({
        status: "applied",
        note: "merged",
        entityId: existing,
      });
      expect(results[1]!.status).toBe("applied");
      expect(await sessions()).toHaveLength(1);
      const lines = await harness.db
        .select()
        .from(schema.orderLine)
        .where(eq(schema.orderLine.tableSessionId, existing));
      expect(lines).toHaveLength(1);
      expect((await sessionOf("sess-1")).id).toBe(existing);
    });

    test("two devices that opened the same Table offline share one session", async () => {
      const results = await push([open("sess-a"), open("sess-b")]);

      expect(results.map((entry) => [entry.status, entry.note])).toEqual([
        ["applied", undefined],
        ["applied", "merged"],
      ]);
      expect(await sessions()).toHaveLength(1);
    });

    test("a settled earlier visit does not block a new session at the Table", async () => {
      const settled = await scenario.openSession({ tableId: tableId("t2") });
      await call(
        restaurantRouter.billing.recordPayment,
        {
          tableSessionId: settled,
          tender: "cash",
          amount: 35_000,
          idempotencyKey: scenario.nextKey(),
        },
        { context: await scenario.as("cashierA") },
      );
      await call(
        restaurantRouter.billing.settle,
        { tableSessionId: settled },
        { context: await scenario.as("cashierA") },
      );

      const [result] = await push([open("sess-1")]);

      expect(result).toMatchObject({ status: "applied" });
      expect(result!.note).toBeUndefined();
      expect((await sessionOf("sess-1")).id).not.toBe(settled);
    });

    test("an unknown Table or one of another Location is rejected", async () => {
      const results = await push([open("sess-1", "missing"), open("sess-2", tableId("b1"))]);

      expect(results[0]).toMatchObject({ status: "rejected", reason: { code: "NOT_FOUND" } });
      expect(results[1]).toMatchObject({ status: "rejected", reason: { code: "FORBIDDEN" } });
      expect(await sessions()).toHaveLength(0);
    });

    test("a record naming a session that was never synced is rejected so the client keeps it", async () => {
      const [result] = await push([lineFor("line-1", "never-opened")]);

      expect(result).toMatchObject({
        status: "rejected",
        reason: { code: "NOT_FOUND", data: { reason: "session_not_synced" } },
      });
    });

    test("a record names its session by id or by key, never both or neither", async () => {
      await push([open("sess-1")]);
      const session = await sessionOf("sess-1");
      const base = lineFor("line-1", "sess-1");

      const results = await push([
        {
          ...base,
          payload: { ...(base.payload as object), tableSessionId: session.id },
        },
        { ...base, idempotencyKey: "line-2", payload: { menuItemId: "x", quantity: 1 } },
        {
          ...base,
          idempotencyKey: "line-3",
          payload: {
            ...(base.payload as object),
            sessionKey: undefined,
            tableSessionId: session.id,
          },
        },
      ]);

      expect(results.map((entry) => entry.status)).toEqual(["rejected", "rejected", "applied"]);
    });

    test("a key already naming a session cannot be reused for another Table", async () => {
      await push([open("sess-1")]);

      const [result] = await push([open("sess-1", tableId("t3"))]);

      expect(result!.status).toBe("already_applied");
      expect(await sessions()).toHaveLength(1);
    });
  });

  describe("moving", () => {
    const tableOf = async (sessionKey: string) => (await sessionOf(sessionKey)).tableId;

    test("moves a session opened in the same batch by its key", async () => {
      const results = await push([
        open("sess-1"),
        move("move-1", { sessionKey: "sess-1" }, tableId("t3"), at(30)),
      ]);

      expect(results.map((entry) => entry.status)).toEqual(["applied", "applied"]);
      expect(await tableOf("sess-1")).toBe(tableId("t3"));
    });

    test("moves a session the server already knows by id", async () => {
      const existing = await scenario.openSession({ tableId: tableId("t2"), lines: [] });

      const [result] = await push([
        move("move-1", { tableSessionId: existing }, tableId("t3"), at(30)),
      ]);

      expect(result).toMatchObject({ status: "applied", entityId: existing });
      const [row] = await harness.db
        .select()
        .from(schema.tableSession)
        .where(eq(schema.tableSession.id, existing));
      expect(row).toMatchObject({ tableId: tableId("t3"), tableMovedAt: at(30) });
    });

    test("the later device move wins whatever the arrival order", async () => {
      await push([open("sess-1")]);
      await push([move("move-new", { sessionKey: "sess-1" }, tableId("t3"), at(30))]);

      const [older] = await push([
        move("move-old", { sessionKey: "sess-1" }, tableId("t1"), at(20)),
      ]);

      expect(older).toMatchObject({ status: "applied", note: "superseded" });
      expect(await tableOf("sess-1")).toBe(tableId("t3"));
    });

    test("a tie on device time goes to the greater key", async () => {
      await push([open("sess-1")]);
      await push([move("move-b", { sessionKey: "sess-1" }, tableId("t3"), at(30))]);
      await push([move("move-a", { sessionKey: "sess-1" }, tableId("t1"), at(30))]);
      expect(await tableOf("sess-1")).toBe(tableId("t3"));

      await push([move("move-c", { sessionKey: "sess-1" }, tableId("t1"), at(30))]);
      expect(await tableOf("sess-1")).toBe(tableId("t1"));
    });

    test("replaying a winning, an overtaken or a superseded move reports already_applied", async () => {
      await push([open("sess-1")]);
      await push([move("move-1", { sessionKey: "sess-1" }, tableId("t3"), at(20))]);
      await push([move("move-2", { sessionKey: "sess-1" }, tableId("t1"), at(30))]);
      await push([move("move-0", { sessionKey: "sess-1" }, tableId("t3"), at(10))]);

      const replays = await push([
        move("move-2", { sessionKey: "sess-1" }, tableId("t1"), at(30)),
        move("move-1", { sessionKey: "sess-1" }, tableId("t3"), at(20)),
        move("move-0", { sessionKey: "sess-1" }, tableId("t3"), at(10)),
      ]);

      expect(replays.map((entry) => entry.status)).toEqual([
        "already_applied",
        "already_applied",
        "already_applied",
      ]);
      expect(await tableOf("sess-1")).toBe(tableId("t1"));
    });

    test("an online move made after the device wrote beats the older synced move", async () => {
      await push([open("sess-1")]);
      const session = await sessionOf("sess-1");
      await call(
        restaurantRouter.orders.moveSession,
        { tableSessionId: session.id, tableId: tableId("t3") },
        { context: await scenario.as("waiterA") },
      );

      const [result] = await push([
        move("move-old", { sessionKey: "sess-1" }, tableId("t1"), at(30)),
      ]);

      expect(result).toMatchObject({ status: "applied", note: "superseded" });
      expect(await tableOf("sess-1")).toBe(tableId("t3"));
    });

    test("moving onto an occupied Table is rejected and the session stays", async () => {
      await scenario.openSession({ tableId: tableId("t3"), lines: [] });
      await push([open("sess-1")]);

      const [result] = await push([
        move("move-1", { sessionKey: "sess-1" }, tableId("t3"), at(30)),
      ]);

      expect(result).toMatchObject({ status: "rejected", reason: { code: "CONFLICT" } });
      expect(await tableOf("sess-1")).toBe(tableId("t2"));
    });

    test("a settled session cannot be moved and a Table of another Location is refused", async () => {
      const settled = await scenario.openSession({ tableId: tableId("t3") });
      await call(
        restaurantRouter.billing.recordPayment,
        {
          tableSessionId: settled,
          tender: "cash",
          amount: 35_000,
          idempotencyKey: scenario.nextKey(),
        },
        { context: await scenario.as("cashierA") },
      );
      await call(
        restaurantRouter.billing.settle,
        { tableSessionId: settled },
        { context: await scenario.as("cashierA") },
      );
      await push([open("sess-1")]);

      const results = await push([
        move("move-1", { tableSessionId: settled }, tableId("t1"), at(30)),
        move("move-2", { sessionKey: "sess-1" }, tableId("b1"), at(31)),
      ]);

      expect(results[0]).toMatchObject({ status: "rejected", reason: { code: "CONFLICT" } });
      expect(results[1]).toMatchObject({ status: "rejected", reason: { code: "BAD_REQUEST" } });
    });

    test("renaming a Table stays a setup action: a Waiter's metadata record is refused", async () => {
      const [result] = await push([
        {
          idempotencyKey: "meta-1",
          kind: "table_metadata",
          deviceRecordedAt: at(10),
          payload: { tableId: tableId("t1"), name: "Barra" },
        },
      ]);

      expect(result).toMatchObject({ status: "rejected", reason: { code: "FORBIDDEN" } });
    });
  });
});
