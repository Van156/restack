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

const reachable = await requireTestDatabaseOrSkip(resolveTestDatabaseUrl(), "restaurant sync");

/** The server clock when the batches below arrive: 2026-10-03 10:00 in Bogota. */
const SYNC_AT = new Date("2026-10-03T15:00:00.000Z");
/** The offline sale: 2026-10-01 13:00 in Bogota, two days before the sync. */
const SOLD_AT = new Date("2026-10-01T18:00:00.000Z");

type SyncRecord = {
  idempotencyKey: string;
  kind: string;
  payload: unknown;
  deviceRecordedAt: Date;
  actingToken?: string;
};

describe.skipIf(!reachable)("restaurant sync: batch push", () => {
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

  type StaffKey = Parameters<typeof scenario.as>[0];

  const push = async (records: SyncRecord[], key: StaffKey = "cashierA") =>
    (await call(restaurantRouter.sync.push, { records }, { context: await scenario.as(key) }))
      .results;

  const line = (key: string, extra: Record<string, unknown> = {}, at = SOLD_AT): SyncRecord => ({
    idempotencyKey: key,
    kind: "order_line",
    deviceRecordedAt: at,
    payload: {
      tableSessionId: sessionId,
      menuItemId: scenario.service.items.beer,
      quantity: 1,
      unitPrice: 6_000,
      ...extra,
    },
  });

  const payment = (key: string, extra: Record<string, unknown> = {}, at = SOLD_AT): SyncRecord => ({
    idempotencyKey: key,
    kind: "payment",
    deviceRecordedAt: at,
    payload: { tableSessionId: sessionId, tender: "cash", amount: 6_000, ...extra },
  });

  const lines = () =>
    harness.db
      .select()
      .from(schema.orderLine)
      .where(eq(schema.orderLine.tableSessionId, sessionId));

  describe("order lines", () => {
    test("a line keeps the price the device recorded, not the current Menu price", async () => {
      await harness.db
        .update(schema.menuItem)
        .set({ price: 9_000 })
        .where(eq(schema.menuItem.id, scenario.service.items.beer));

      const [result] = await push([line("line-1", { quantity: 2 })]);

      expect(result).toMatchObject({
        idempotencyKey: "line-1",
        kind: "order_line",
        status: "applied",
      });
      const [stored] = await lines();
      expect(stored).toMatchObject({ unitPrice: 6_000, quantity: 2, clientRecordedAt: SOLD_AT });
    });

    test("recorded modifier deltas win over the current ones", async () => {
      await harness.db
        .update(schema.modifier)
        .set({ priceDelta: 5_000 })
        .where(eq(schema.modifier.id, scenario.service.modifiers.cheese));

      await push([
        line("line-1", {
          menuItemId: scenario.service.items.burger,
          unitPrice: 20_000,
          modifiers: [
            { modifierId: scenario.service.modifiers.medium, priceDelta: 0 },
            { modifierId: scenario.service.modifiers.cheese, priceDelta: 2_000 },
          ],
        }),
      ]);

      const [stored] = await lines();
      expect(stored!.modifiers.find((m) => m.name === "Queso")?.priceDelta).toBe(2_000);
    });

    test("a line recorded before the item sold out is still accepted", async () => {
      await harness.db.insert(schema.menuItemAvailability).values({
        organizationId: scenario.seed.organizationId,
        locationId: scenario.seed.locations.a,
        menuItemId: scenario.service.items.beer,
        soldOut: true,
      });

      const [result] = await push([line("line-1")]);

      expect(result!.status).toBe("applied");
      expect(await lines()).toHaveLength(1);
    });

    test("replaying a batch reports already_applied and adds nothing", async () => {
      await push([line("line-1")]);
      const [replay] = await push([line("line-1")]);

      expect(replay!.status).toBe("already_applied");
      expect(await lines()).toHaveLength(1);
    });

    test("a key reused for another Table session is rejected", async () => {
      await push([line("line-1")]);
      const other = await scenario.openSession({ tableId: scenario.service.tables.t2, lines: [] });

      const [result] = await push([line("line-1", { tableSessionId: other })]);

      expect(result).toMatchObject({ status: "rejected", reason: { code: "CONFLICT" } });
    });
  });

  describe("batches", () => {
    test("a rejection in the middle does not stop or undo the other records", async () => {
      const results = await push([
        line("line-1"),
        line("line-2", { menuItemId: "missing-item" }),
        line("line-3", { quantity: 3 }),
      ]);

      expect(results.map((entry) => entry.status)).toEqual(["applied", "rejected", "applied"]);
      expect(results[1]!.reason).toMatchObject({ code: "NOT_FOUND" });
      expect((await lines()).map((row) => row.quantity).sort()).toEqual([1, 3]);
    });

    test("results come back in the order of the records", async () => {
      const results = await push([line("b"), line("a"), line("c")]);
      expect(results.map((entry) => entry.idempotencyKey)).toEqual(["b", "a", "c"]);
    });

    test("an unknown kind or a malformed payload is rejected without failing the batch", async () => {
      const results = await push([
        { idempotencyKey: "x-1", kind: "teleport", payload: {}, deviceRecordedAt: SOLD_AT },
        line("line-bad", { quantity: 0 }),
        line("line-ok"),
      ]);

      expect(results.map((entry) => entry.status)).toEqual(["rejected", "rejected", "applied"]);
      expect(results[0]!.reason).toMatchObject({ code: "BAD_REQUEST" });
      expect(results[1]!.reason).toMatchObject({ code: "BAD_REQUEST" });
    });

    test("every record needs its own permission: a Waiter's lines apply, charging is refused", async () => {
      const results = await push([line("line-1"), payment("pay-1")], "waiterA");

      expect(results.map((entry) => entry.status)).toEqual(["applied", "rejected"]);
      expect(results[1]!.reason).toMatchObject({ code: "FORBIDDEN" });
    });

    test("Location scope is checked per record", async () => {
      const [result] = await push([line("line-1")], "waiterB");

      expect(result).toMatchObject({ status: "rejected", reason: { code: "FORBIDDEN" } });
      expect(await lines()).toHaveLength(0);
    });

    test("a record carries its acting token: the line is attributed to that member", async () => {
      const { actingToken } = await call(
        restaurantRouter.staff.switchIn,
        {
          locationId: scenario.seed.locations.a,
          memberId: scenario.seed.staff.waiterA.memberId,
          pin: "4821",
        },
        { context: await scenario.as("cashierA") },
      );

      const results = await push([
        { ...line("line-1"), actingToken },
        { ...line("line-2"), actingToken: "forged" },
      ]);

      expect(results.map((entry) => entry.status)).toEqual(["applied", "rejected"]);
      const [stored] = await lines();
      expect(stored!.recordedByMemberId).toBe(scenario.seed.staff.waiterA.memberId);
    });
  });

  describe("acting tokens at device time", () => {
    const MINUTE = 60_000;
    const HOUR = 60 * MINUTE;

    /** Mints a 15 minute acting token for the Waiter at `mintedAt`, then returns to the sync clock. */
    const mintWaiterToken = async (mintedAt: Date) => {
      harness.clock.setNow(mintedAt);
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
      return actingToken;
    };

    test("a record made at minute 10 of a 15 minute token, synced 20 hours later, is attributed to that member", async () => {
      const mintedAt = new Date(SYNC_AT.getTime() - 20 * HOUR);
      const actingToken = await mintWaiterToken(mintedAt);

      const [result] = await push([
        {
          ...line("line-1", {}, new Date(mintedAt.getTime() + 10 * MINUTE)),
          actingToken,
        },
      ]);

      expect(result!.status).toBe("applied");
      const [stored] = await lines();
      expect(stored!.recordedByMemberId).toBe(scenario.seed.staff.waiterA.memberId);
    });

    test("a record made at minute 20, after the token expired, is rejected", async () => {
      const mintedAt = new Date(SYNC_AT.getTime() - 20 * HOUR);
      const actingToken = await mintWaiterToken(mintedAt);

      const [result] = await push([
        {
          ...line("line-1", {}, new Date(mintedAt.getTime() + 20 * MINUTE)),
          actingToken,
        },
      ]);

      expect(result).toMatchObject({ status: "rejected", reason: { code: "FORBIDDEN" } });
      expect(await lines()).toHaveLength(0);
    });

    test("a record older than the 48 hour offline window is rejected even inside the token's life", async () => {
      const mintedAt = new Date(SYNC_AT.getTime() - 50 * HOUR);
      const actingToken = await mintWaiterToken(mintedAt);

      const [result] = await push([
        {
          ...line("line-1", {}, new Date(mintedAt.getTime() + 5 * MINUTE)),
          actingToken,
        },
      ]);

      expect(result).toMatchObject({ status: "rejected", reason: { code: "FORBIDDEN" } });
    });

    test("a device clock ahead of the server cannot stretch an expired token", async () => {
      const mintedAt = new Date(SYNC_AT.getTime() - 20 * HOUR);
      const actingToken = await mintWaiterToken(mintedAt);

      const [result] = await push([
        { ...line("line-1", {}, new Date(SYNC_AT.getTime() + HOUR)), actingToken },
      ]);

      expect(result).toMatchObject({ status: "rejected", reason: { code: "FORBIDDEN" } });
    });

    test("a payment record is checked at its device time too", async () => {
      const mintedAt = new Date(SYNC_AT.getTime() - 20 * HOUR);
      harness.clock.setNow(mintedAt);
      const { actingToken } = await call(
        restaurantRouter.staff.switchIn,
        {
          locationId: scenario.seed.locations.a,
          memberId: scenario.seed.staff.cashierA.memberId,
          pin: "4821",
        },
        { context: await scenario.as("cashierA") },
      );
      harness.clock.setNow(SYNC_AT);
      await push([line("line-1")]);

      const [result] = await push([
        { ...payment("pay-1", {}, new Date(mintedAt.getTime() + 10 * MINUTE)), actingToken },
      ]);

      expect(result!.status).toBe("applied");
    });
  });

  describe("voids", () => {
    test("an unsent line is voided by the key it was recorded with", async () => {
      const results = await push([
        line("line-1"),
        {
          idempotencyKey: "void-1",
          kind: "void",
          deviceRecordedAt: SOLD_AT,
          payload: { lineKey: "line-1" },
        },
      ]);

      expect(results.map((entry) => entry.status)).toEqual(["applied", "applied"]);
      expect(await harness.db.select().from(schema.orderLineVoid)).toHaveLength(1);
    });

    test("a sent line without an Override is rejected and stays on the Bill", async () => {
      await push([line("line-1")]);
      await call(
        restaurantRouter.orders.sendToKitchen,
        { tableSessionId: sessionId },
        { context: await scenario.as("waiterA") },
      );

      const [result] = await push([
        {
          idempotencyKey: "void-1",
          kind: "void",
          deviceRecordedAt: SOLD_AT,
          payload: { lineKey: "line-1" },
        },
      ]);

      expect(result).toMatchObject({
        status: "rejected",
        reason: { code: "FORBIDDEN", data: { reason: "override_required" } },
      });
      expect(await harness.db.select().from(schema.orderLineVoid)).toHaveLength(0);
    });

    test("a sent line with a valid Override presented at sync time is voided and the Override spent", async () => {
      await push([line("line-1")]);
      await call(
        restaurantRouter.orders.sendToKitchen,
        { tableSessionId: sessionId },
        { context: await scenario.as("waiterA") },
      );
      const [stored] = await lines();
      const overrideId = await scenario.mintOverride("void_line", stored!.id);

      const [result] = await push([
        {
          idempotencyKey: "void-1",
          kind: "void",
          deviceRecordedAt: SOLD_AT,
          payload: { lineId: stored!.id, overrideId },
        },
      ]);

      expect(result!.status).toBe("applied");
      const [spent] = await harness.db
        .select()
        .from(schema.override)
        .where(eq(schema.override.id, overrideId));
      expect(spent!.usedAt).not.toBeNull();
    });

    test("an invalid Override rejects the void and burns nothing", async () => {
      await push([line("line-1")]);
      await call(
        restaurantRouter.orders.sendToKitchen,
        { tableSessionId: sessionId },
        { context: await scenario.as("waiterA") },
      );
      const [stored] = await lines();
      const overrideId = await scenario.mintOverride("discount", sessionId);

      const [result] = await push([
        {
          idempotencyKey: "void-1",
          kind: "void",
          deviceRecordedAt: SOLD_AT,
          payload: { lineId: stored!.id, overrideId },
        },
      ]);

      expect(result).toMatchObject({ status: "rejected", reason: { code: "FORBIDDEN" } });
      const [override] = await harness.db
        .select()
        .from(schema.override)
        .where(eq(schema.override.id, overrideId));
      expect(override!.usedAt).toBeNull();
    });

    test("replaying a void reports already_applied", async () => {
      const void1: SyncRecord = {
        idempotencyKey: "void-1",
        kind: "void",
        deviceRecordedAt: SOLD_AT,
        payload: { lineKey: "line-1" },
      };
      await push([line("line-1"), void1]);

      const results = await push([line("line-1"), void1]);

      expect(results.map((entry) => entry.status)).toEqual(["already_applied", "already_applied"]);
    });
  });

  describe("payments and takings", () => {
    test("a payment keeps the original sale time and the offline flag, and replays by key", async () => {
      await push([line("line-1")]);
      const first = await push([payment("pay-1", { registeredOffline: true })]);
      const replay = await push([payment("pay-1", { registeredOffline: true })]);

      expect(first[0]!.status).toBe("applied");
      expect(replay[0]!.status).toBe("already_applied");
      const rows = await harness.db.select().from(schema.payment);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        clientRecordedAt: SOLD_AT,
        registeredOffline: true,
        recordedAt: SYNC_AT,
      });
    });

    test("a payment above the balance is rejected", async () => {
      await push([line("line-1")]);

      const [result] = await push([payment("pay-1", { amount: 7_000 })]);

      expect(result).toMatchObject({ status: "rejected", reason: { code: "CONFLICT" } });
      expect(await harness.db.select().from(schema.payment)).toHaveLength(0);
    });

    test("takings are always flagged as registered offline", async () => {
      await push([line("line-1")]);

      const [result] = await push([
        { ...payment("tak-1", { registeredOffline: false }), kind: "takings" },
      ]);

      expect(result).toMatchObject({ kind: "takings", status: "applied" });
      const [row] = await harness.db.select().from(schema.payment);
      expect(row!.registeredOffline).toBe(true);
    });

    test("with settle, the Bill settles at the original sale time", async () => {
      await push([line("line-1")]);

      const [result] = await push([payment("pay-1", { settle: true })]);

      expect(result!.status).toBe("applied");
      const [bill] = await harness.db.select().from(schema.bill);
      expect(bill).toMatchObject({ status: "settled", settledAt: SOLD_AT });
      const [session] = await harness.db
        .select()
        .from(schema.tableSession)
        .where(eq(schema.tableSession.id, sessionId));
      expect(session).toMatchObject({ status: "settled", settledAt: SOLD_AT });
    });

    test("settle on a payment that leaves a balance rejects the whole record", async () => {
      await push([line("line-1")]);

      const [result] = await push([payment("pay-1", { amount: 2_000, settle: true })]);

      expect(result).toMatchObject({ status: "rejected", reason: { code: "CONFLICT" } });
      expect(await harness.db.select().from(schema.payment)).toHaveLength(0);
    });

    test("payments attach to the open Cash shift, or to the next shift opened", async () => {
      await push([line("line-1", { quantity: 2 })]);
      await push([payment("pay-1")]);
      const [unattached] = await harness.db.select().from(schema.payment);
      expect(unattached!.cashShiftId).toBeNull();

      const shift = await scenario.openShift();
      await push([payment("pay-2", { registeredOffline: true })]);

      const rows = await harness.db.select().from(schema.payment);
      expect(rows.map((row) => row.cashShiftId)).toEqual([shift.id, shift.id]);
      const takings = await call(
        restaurantRouter.cashShift.offlineTakings,
        { cashShiftId: shift.id },
        { context: await scenario.as("cashierA") },
      );
      expect(takings).toHaveLength(1);
    });
  });

  describe("Table metadata", () => {
    const tableId = () => scenario.service.tables.t1;
    const metadata = (key: string, at: Date, payload: Record<string, unknown>): SyncRecord => ({
      idempotencyKey: key,
      kind: "table_metadata",
      deviceRecordedAt: at,
      payload: { tableId: tableId(), ...payload },
    });
    const readTable = async () =>
      (
        await harness.db
          .select()
          .from(schema.diningTable)
          .where(eq(schema.diningTable.id, tableId()))
      )[0]!;
    const T1 = new Date("2026-10-03T14:00:00.000Z");
    const T2 = new Date("2026-10-03T14:30:00.000Z");

    test("the later device write wins whatever the arrival order", async () => {
      await push([metadata("meta-new", T2, { name: "Terraza 1" })], "owner");
      const [older] = await push([metadata("meta-old", T1, { name: "Barra" })], "owner");

      expect(older).toMatchObject({ status: "applied", note: "superseded" });
      expect((await readTable()).name).toBe("Terraza 1");
    });

    test("a tie on device time goes to the greater key, whatever the arrival order", async () => {
      await push([metadata("meta-b", T1, { name: "Barra B" })], "owner");
      await push([metadata("meta-a", T1, { name: "Barra A" })], "owner");
      expect((await readTable()).name).toBe("Barra B");

      await push([metadata("meta-c", T1, { name: "Barra C" })], "owner");
      expect((await readTable()).name).toBe("Barra C");
    });

    test("replaying the winning write reports already_applied", async () => {
      await push([metadata("meta-1", T1, { seats: 6 })], "owner");
      const [replay] = await push([metadata("meta-1", T1, { seats: 6 })], "owner");

      expect(replay!.status).toBe("already_applied");
    });

    test("a device clock ahead of the server is clamped, so a later real write still wins", async () => {
      const future = new Date("2027-01-01T00:00:00.000Z");
      await push([metadata("meta-future", future, { name: "Futuro" })], "owner");
      expect((await readTable()).metadataWrittenAt).toEqual(SYNC_AT);

      const later = new Date(SYNC_AT.getTime() + 30_000);
      harness.clock.setNow(later);
      await push([metadata("meta-a", later, { name: "Ahora" })], "owner");

      expect((await readTable()).name).toBe("Ahora");
    });

    test("moves a Table to another Area and renames it; a name clash is rejected", async () => {
      const [other] = await harness.db
        .insert(schema.area)
        .values({
          organizationId: scenario.seed.organizationId,
          locationId: scenario.seed.locations.a,
          name: "Terraza",
        })
        .returning();

      const results = await push(
        [
          metadata("meta-1", T1, { areaId: other!.id, name: "T-1" }),
          metadata("meta-2", T2, { name: "M2" }),
        ],
        "owner",
      );

      expect(results.map((entry) => entry.status)).toEqual(["applied", "rejected"]);
      expect(results[1]!.reason).toMatchObject({ code: "CONFLICT" });
      expect(await readTable()).toMatchObject({ areaId: other!.id, name: "T-1" });
    });

    test("an online edit made after the device wrote beats the older synced write", async () => {
      await call(
        restaurantRouter.tables.update,
        { tableId: tableId(), name: "En línea" },
        { context: await scenario.as("owner") },
      );

      const [result] = await push([metadata("meta-old", T1, { name: "Barra" })], "owner");

      expect(result).toMatchObject({ status: "applied", note: "superseded" });
      expect((await readTable()).name).toBe("En línea");
    });

    test("needs setup permission and Location access", async () => {
      const [waiter] = await push([metadata("meta-1", T1, { name: "X" })], "waiterA");
      expect(waiter).toMatchObject({ status: "rejected", reason: { code: "FORBIDDEN" } });
    });
  });

  describe("document requests and the original sale time", () => {
    const documentRequest = (key = "doc-1", extra: Record<string, unknown> = {}): SyncRecord => ({
      idempotencyKey: key,
      kind: "document_request",
      deviceRecordedAt: SOLD_AT,
      payload: { tableSessionId: sessionId, ...extra },
    });

    test("an offline sale from two days ago keeps its sale time on Payment, Bill, DIAN document and report day", async () => {
      const results = await push([
        line("line-1", { quantity: 2 }),
        payment("pay-1", { amount: 12_000, registeredOffline: true, settle: true }),
        documentRequest(),
      ]);

      expect(results.map((entry) => entry.status)).toEqual(["applied", "applied", "applied"]);
      const [paid] = await harness.db.select().from(schema.payment);
      const [bill] = await harness.db.select().from(schema.bill);
      const [document] = await harness.db.select().from(schema.dianDocument);
      expect(paid!.clientRecordedAt).toEqual(SOLD_AT);
      expect(bill!.settledAt).toEqual(SOLD_AT);
      expect(document).toMatchObject({ saleTime: SOLD_AT, contingency: true });
      expect((document!.payload as { saleTime: string }).saleTime).toBe(SOLD_AT.toISOString());

      const owner = await scenario.as("owner");
      const soldDay = await call(
        restaurantRouter.reports.daily,
        { date: "2026-10-01" },
        { context: owner },
      );
      const syncDay = await call(
        restaurantRouter.reports.daily,
        { date: "2026-10-03" },
        { context: owner },
      );
      expect(soldDay).toMatchObject({ billCount: 1, salesTotal: 12_000 });
      expect(soldDay.documents.total).toBe(1);
      expect(syncDay).toMatchObject({ billCount: 0 });
      expect(syncDay.documents.total).toBe(0);
    });

    test("the 48 hour transmission deadline counts from when the request reached the server", async () => {
      await push([line("line-1"), payment("pay-1", { settle: true }), documentRequest()]);

      const [outbox] = await harness.db.select().from(schema.dianOutbox);
      expect(outbox!.transmitBy).toEqual(new Date(SYNC_AT.getTime() + 48 * 60 * 60 * 1000));
    });

    test("a request replays by Bill and kind: already_applied, one document", async () => {
      await push([line("line-1"), payment("pay-1", { settle: true }), documentRequest()]);

      const [replay] = await push([documentRequest("doc-retry")]);

      expect(replay!.status).toBe("already_applied");
      expect(await harness.db.select().from(schema.dianDocument)).toHaveLength(1);
      expect(harness.invoicing.issued).toHaveLength(1);
    });

    test("a Bill that is not settled yet rejects the request", async () => {
      await push([line("line-1")]);

      const [result] = await push([documentRequest()]);

      expect(result).toMatchObject({ status: "rejected", reason: { code: "CONFLICT" } });
      expect(await harness.db.select().from(schema.dianDocument)).toHaveLength(0);
    });

    test("an unreachable provider keeps the document pending in the outbox and the record applied", async () => {
      harness.invoicing.setReachable(false);
      await push([line("line-1"), payment("pay-1", { settle: true })]);

      const [result] = await push([documentRequest()]);

      expect(result!.status).toBe("applied");
      const [document] = await harness.db.select().from(schema.dianDocument);
      expect(document!.status).toBe("pending");
    });
  });

  test("the batch size is bounded", async () => {
    const records = Array.from({ length: 201 }, (_, index) => line(`line-${index}`));
    const code = await scenario.codeOf(
      call(restaurantRouter.sync.push, { records }, { context: await scenario.as("cashierA") }),
    );
    expect(code).toBe("BAD_REQUEST");
  });
});
