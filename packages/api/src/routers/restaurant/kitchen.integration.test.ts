import { resolveTestDatabaseUrl } from "@base-template/auth/testing";
import * as schema from "@base-template/db/schema";
import { requireTestDatabaseOrSkip } from "@base-template/db/testing";
import { call, ORPCError } from "@orpc/server";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";

import { seedService } from "../../testing/orders-fixtures";
import type { ServiceSeed } from "../../testing/orders-fixtures";
import { createRestaurantHarness } from "../../testing/restaurant-fixtures";
import type { RestaurantHarness, RestaurantSeed } from "../../testing/restaurant-fixtures";
import { restaurantRouter } from "./index";

const reachable = await requireTestDatabaseOrSkip(resolveTestDatabaseUrl(), "restaurant kitchen");

const SECOND_MS = 1000;
const MINUTE_MS = 60 * SECOND_MS;

describe.skipIf(!reachable)("restaurant kitchen display", () => {
  let harness: RestaurantHarness;
  let seed: RestaurantSeed;
  let service: ServiceSeed;
  let sessionId: string;
  let tickets: { kitchen: string; bar: string };
  let kitchenToken: string;
  let barToken: string;
  let keyCounter = 0;

  beforeAll(async () => {
    harness = await createRestaurantHarness();
  });
  afterAll(async () => {
    await harness.close();
  });
  beforeEach(async () => {
    await harness.reset();
    harness.clock.setNow(new Date("2026-10-02T15:00:00.000Z"));
    seed = await harness.seedRestaurant();
    service = await seedService(harness, seed);
    sessionId = await openSession();
    tickets = await sendOrder(sessionId);
    kitchenToken = await pairDevice([service.stations.kitchen]);
    barToken = await pairDevice([service.stations.bar]);
  });

  const as = (key: keyof RestaurantSeed["staff"]) =>
    harness.contextFor(seed.staff[key].userId, seed.organizationId);
  const anonymous = async () => ({ ...(await as("owner")), session: null });
  const nextKey = () => `kitchen-key-${(keyCounter += 1)}`;
  const advanceClock = (ms: number) =>
    harness.clock.setNow(new Date(harness.clock.now().getTime() + ms));

  async function codeOf(promise: Promise<unknown>): Promise<string | undefined> {
    try {
      await promise;
    } catch (error) {
      return error instanceof ORPCError ? error.code : "NOT_AN_ORPC_ERROR";
    }
    return undefined;
  }

  async function openSession(tableId = service.tables.t1) {
    const session = await call(
      restaurantRouter.orders.openSession,
      { locationId: seed.locations.a, tableId },
      { context: await as("waiterA") },
    );
    return session.id;
  }

  async function sendOrder(tableSessionId: string) {
    const common = { tableSessionId, quantity: 1 };
    const context = await as("waiterA");
    await call(
      restaurantRouter.orders.addLine,
      {
        ...common,
        menuItemId: service.items.burger,
        modifierIds: [service.modifiers.wellDone, service.modifiers.cheese],
        note: "sin cebolla",
        idempotencyKey: nextKey(),
      },
      { context },
    );
    await call(
      restaurantRouter.orders.addLine,
      { ...common, menuItemId: service.items.beer, idempotencyKey: nextKey() },
      { context },
    );
    const sent = await call(restaurantRouter.orders.sendToKitchen, { tableSessionId }, { context });
    const idOf = (stationId: string) => sent.tickets.find((t) => t.stationId === stationId)!.id;
    return {
      kitchen: idOf(service.stations.kitchen),
      bar: idOf(service.stations.bar),
    };
  }

  async function pairDevice(stationIds: string[]) {
    const pairing = await call(
      restaurantRouter.devices.createPairing,
      { locationId: seed.locations.a, name: "Pantalla", stationIds },
      { context: await as("admin") },
    );
    const redeemed = await call(
      restaurantRouter.devices.redeem,
      { code: pairing.code },
      { context: await anonymous() },
    );
    return redeemed.deviceToken;
  }

  const asDevice = (token: string) => harness.contextForDevice(token);

  async function listAs(context: Awaited<ReturnType<typeof as>>, input = {}) {
    return call(restaurantRouter.kitchen.list, input, { context });
  }

  async function advance(
    context: Awaited<ReturnType<typeof as>>,
    ticketId: string,
    status: "preparando" | "listo" | "entregado",
  ) {
    return call(restaurantRouter.kitchen.advance, { ticketId, status }, { context });
  }

  describe("listing Tickets for a Paired device", () => {
    test("shows its Station's Ticket with Table, Waiter, lines, modifiers, note, status and age", async () => {
      advanceClock(90 * SECOND_MS);
      const list = await listAs(await asDevice(kitchenToken));
      expect(list).toHaveLength(1);
      expect(list[0]).toMatchObject({
        id: tickets.kitchen,
        status: "nuevo",
        stationId: service.stations.kitchen,
        tableName: "M1",
        sentByName: "waiter-a",
        ageMs: 90 * SECOND_MS,
        startedAt: null,
        readyAt: null,
        deliveredAt: null,
      });
      expect(list[0]!.lines).toHaveLength(1);
      expect(list[0]!.lines[0]).toMatchObject({
        itemName: "Hamburguesa",
        quantity: 1,
        note: "sin cebolla",
        voided: false,
      });
      expect(list[0]!.lines[0]!.modifiers.map((m) => m.name)).toEqual(["Bien cocido", "Queso"]);
    });

    test("never exposes prices to the device", async () => {
      const [ticket] = await listAs(await asDevice(kitchenToken));
      expect(JSON.stringify(ticket)).not.toMatch(/price|unitPrice|priceDelta/i);
    });

    test("a device bound to the bar sees only the bar Ticket", async () => {
      const list = await listAs(await asDevice(barToken));
      expect(list.map((ticket) => ticket.id)).toEqual([tickets.bar]);
    });

    test("a device cannot read another Station's Tickets by asking for it", async () => {
      const context = await asDevice(kitchenToken);
      expect(await codeOf(listAs(context, { stationId: service.stations.bar }))).toBe("FORBIDDEN");
      expect(await codeOf(listAs(context, { locationId: seed.locations.b }))).toBe("FORBIDDEN");
      const own = await listAs(context, {
        stationId: service.stations.kitchen,
      });
      expect(own.map((ticket) => ticket.id)).toEqual([tickets.kitchen]);
    });

    test("a voided sent line is flagged on the Ticket, not hidden", async () => {
      const [line] = await harness.db
        .select({ id: schema.orderLine.id })
        .from(schema.orderLine)
        .where(eq(schema.orderLine.itemName, "Cerveza"));
      await harness.db.insert(schema.orderLineVoid).values({
        organizationId: seed.organizationId,
        orderLineId: line!.id,
        recordedAt: harness.clock.now(),
        idempotencyKey: nextKey(),
      });
      const [ticket] = await listAs(await asDevice(barToken));
      expect(ticket!.lines).toHaveLength(1);
      expect(ticket!.lines[0]).toMatchObject({
        itemName: "Cerveza",
        voided: true,
      });
    });

    test("a revoked or unknown device token is rejected", async () => {
      const [device] = await harness.db.select().from(schema.pairedDevice).limit(1);
      await harness.db
        .update(schema.pairedDevice)
        .set({ status: "revoked" })
        .where(eq(schema.pairedDevice.id, device!.id));
      expect(await codeOf(listAs(await asDevice(kitchenToken)))).toBe("UNAUTHORIZED");
      expect(await codeOf(listAs(await asDevice("not-a-token")))).toBe("UNAUTHORIZED");
    });

    test("every call records the device as seen", async () => {
      advanceClock(5 * MINUTE_MS);
      await listAs(await asDevice(kitchenToken));
      const rows = await harness.db.select().from(schema.pairedDevice);
      expect(rows.some((row) => row.lastSeenAt?.getTime() === harness.clock.now().getTime())).toBe(
        true,
      );
    });

    test("delivered Tickets of an earlier business day drop off, earlier unfinished ones stay", async () => {
      const context = await asDevice(kitchenToken);
      await advance(context, tickets.kitchen, "preparando");
      await advance(context, tickets.kitchen, "listo");
      await advance(context, tickets.kitchen, "entregado");
      expect(await listAs(context)).toHaveLength(1);
      advanceClock(24 * 60 * MINUTE_MS);
      expect(await listAs(context)).toHaveLength(0);
      expect(await listAs(await asDevice(barToken))).toHaveLength(1);
    });
  });

  describe("listing Tickets for Staff", () => {
    test("a Waiter of the Location sees every Station, or one when filtered", async () => {
      const context = await as("waiterA");
      const all = await listAs(context, { locationId: seed.locations.a });
      expect(all.map((ticket) => ticket.id).sort()).toEqual([tickets.kitchen, tickets.bar].sort());
      const bar = await listAs(context, {
        locationId: seed.locations.a,
        stationId: service.stations.bar,
      });
      expect(bar.map((ticket) => ticket.id)).toEqual([tickets.bar]);
    });

    test("Location scope is enforced; the Owner sees any Location", async () => {
      const input = { locationId: seed.locations.a };
      expect(await codeOf(listAs(await as("waiterB"), input))).toBe("FORBIDDEN");
      expect(await listAs(await as("owner"), input)).toHaveLength(2);
    });

    test("Staff must name a Location, and a Station must belong to it", async () => {
      expect(await codeOf(listAs(await as("waiterA")))).toBe("BAD_REQUEST");
      const code = await codeOf(
        listAs(await as("owner"), {
          locationId: seed.locations.b,
          stationId: service.stations.bar,
        }),
      );
      expect(code).toBe("NOT_FOUND");
    });

    test("a caller with neither a session nor a device is rejected", async () => {
      expect(await codeOf(listAs(await anonymous(), { locationId: seed.locations.a }))).toBe(
        "UNAUTHORIZED",
      );
    });
  });

  describe("advancing a Ticket", () => {
    test("moves forward one step at a time and records each transition time", async () => {
      const context = await asDevice(kitchenToken);
      const t0 = harness.clock.now().getTime();
      advanceClock(2 * MINUTE_MS);
      const started = await advance(context, tickets.kitchen, "preparando");
      expect(started).toMatchObject({
        status: "preparando",
        startedAt: new Date(t0 + 2 * MINUTE_MS),
      });
      advanceClock(8 * MINUTE_MS);
      const ready = await advance(context, tickets.kitchen, "listo");
      expect(ready).toMatchObject({
        status: "listo",
        readyAt: new Date(t0 + 10 * MINUTE_MS),
      });
      advanceClock(3 * MINUTE_MS);
      const delivered = await advance(context, tickets.kitchen, "entregado");
      expect(delivered).toMatchObject({
        status: "entregado",
        deliveredAt: new Date(t0 + 13 * MINUTE_MS),
        startedAt: new Date(t0 + 2 * MINUTE_MS),
        readyAt: new Date(t0 + 10 * MINUTE_MS),
      });
    });

    test("cannot skip a status or go back; repeating the same step is a no-op", async () => {
      const context = await asDevice(kitchenToken);
      expect(await codeOf(advance(context, tickets.kitchen, "listo"))).toBe("CONFLICT");
      await advance(context, tickets.kitchen, "preparando");
      advanceClock(MINUTE_MS);
      const replay = await advance(context, tickets.kitchen, "preparando");
      expect(replay.startedAt).toEqual(new Date("2026-10-02T15:00:00.000Z"));
      await advance(context, tickets.kitchen, "listo");
      expect(await codeOf(advance(context, tickets.kitchen, "preparando"))).toBe("CONFLICT");
    });

    test("a device can only advance Tickets of its own Stations", async () => {
      const context = await asDevice(kitchenToken);
      expect(await codeOf(advance(context, tickets.bar, "preparando"))).toBe("NOT_FOUND");
      const [bar] = await harness.db
        .select()
        .from(schema.ticket)
        .where(eq(schema.ticket.id, tickets.bar));
      expect(bar!.status).toBe("nuevo");
    });

    test("an unknown Ticket is NOT_FOUND", async () => {
      const context = await asDevice(kitchenToken);
      expect(await codeOf(advance(context, "missing", "preparando"))).toBe("NOT_FOUND");
    });

    test("Staff of the Location can advance, other Locations cannot", async () => {
      const done = await advance(await as("waiterA"), tickets.bar, "preparando");
      expect(done.status).toBe("preparando");
      expect(await codeOf(advance(await as("waiterB"), tickets.bar, "listo"))).toBe("FORBIDDEN");
    });
  });

  describe("ready marker on the floor plan", () => {
    test("a session with a Ticket ready to deliver is marked until it is delivered", async () => {
      const flags = async () =>
        (
          await call(
            restaurantRouter.orders.listOpenSessions,
            { locationId: seed.locations.a },
            { context: await as("waiterA") },
          )
        ).map((row) => [row.id, row.hasReadyTicket]);
      expect(await flags()).toEqual([[sessionId, false]]);
      const context = await asDevice(barToken);
      await advance(context, tickets.bar, "preparando");
      expect(await flags()).toEqual([[sessionId, false]]);
      await advance(context, tickets.bar, "listo");
      expect(await flags()).toEqual([[sessionId, true]]);
      await advance(context, tickets.bar, "entregado");
      expect(await flags()).toEqual([[sessionId, false]]);
    });
  });

  describe("timing metrics", () => {
    async function runTicket(
      token: string,
      ticketId: string,
      prepMinutes: number,
      pickupMinutes: number,
    ) {
      const context = await asDevice(token);
      await advance(context, ticketId, "preparando");
      advanceClock(prepMinutes * MINUTE_MS);
      await advance(context, ticketId, "listo");
      advanceClock(pickupMinutes * MINUTE_MS);
      await advance(context, ticketId, "entregado");
    }

    async function metrics(key: keyof RestaurantSeed["staff"] = "admin", input = {}) {
      return call(
        restaurantRouter.kitchen.metrics,
        { locationId: seed.locations.a, date: "2026-10-02", ...input },
        { context: await as(key) },
      );
    }

    test("preparation time and pickup wait per Station over the business day", async () => {
      await runTicket(kitchenToken, tickets.kitchen, 10, 2);
      const second = await sendOrder(await openSession(service.tables.t2));
      await runTicket(kitchenToken, second.kitchen, 20, 4);
      await runTicket(barToken, tickets.bar, 3, 1);

      const result = await metrics();
      expect(result.total).toMatchObject({
        ticketCount: 4,
        completedCount: 3,
        avgPrepMs: 11 * MINUTE_MS,
        maxPrepMs: 20 * MINUTE_MS,
        avgPickupMs: (7 / 3) * MINUTE_MS,
        maxPickupMs: 4 * MINUTE_MS,
        // the bar Ticket waited for the other two runs before it was started
        avgSentToReadyMs: 23 * MINUTE_MS,
        maxSentToReadyMs: 39 * MINUTE_MS,
      });
      const kitchen = result.stations.find((row) => row.stationId === service.stations.kitchen);
      expect(kitchen).toMatchObject({
        stationName: "Cocina",
        ticketCount: 2,
        avgPrepMs: 15 * MINUTE_MS,
        maxPrepMs: 20 * MINUTE_MS,
        avgPickupMs: 3 * MINUTE_MS,
        maxPickupMs: 4 * MINUTE_MS,
        avgSentToReadyMs: 15 * MINUTE_MS,
        maxSentToReadyMs: 20 * MINUTE_MS,
      });
      const bar = result.stations.find((row) => row.stationId === service.stations.bar);
      expect(bar).toMatchObject({
        ticketCount: 2,
        avgPrepMs: 3 * MINUTE_MS,
        avgSentToReadyMs: 39 * MINUTE_MS,
      });
    });

    test("a Station without finished Tickets reports no averages; days are separate", async () => {
      const result = await metrics("admin", {
        stationId: service.stations.kitchen,
      });
      expect(result.stations).toHaveLength(1);
      expect(result.stations[0]).toMatchObject({
        ticketCount: 1,
        completedCount: 0,
        avgPrepMs: null,
        maxPrepMs: null,
        avgPickupMs: null,
        maxPickupMs: null,
        avgSentToReadyMs: null,
        maxSentToReadyMs: null,
      });
      const tomorrow = await metrics("admin", { date: "2026-10-03" });
      expect(tomorrow.total.ticketCount).toBe(0);
    });

    test("only Owner and Administrator read metrics, within their Locations", async () => {
      expect(await codeOf(metrics("waiterA"))).toBe("FORBIDDEN");
      expect(await codeOf(metrics("cashierA"))).toBe("FORBIDDEN");
      expect((await metrics("owner")).total.ticketCount).toBe(2);
      expect(await codeOf(metrics("admin", { locationId: seed.locations.b }))).toBe("FORBIDDEN");
      expect(await codeOf(metrics("admin", { date: "2026-13-45" }))).toBe("BAD_REQUEST");
    });

    test("a Paired device cannot read metrics", async () => {
      const context = await asDevice(kitchenToken);
      const code = await codeOf(
        call(
          restaurantRouter.kitchen.metrics,
          { locationId: seed.locations.a, date: "2026-10-02" },
          { context },
        ),
      );
      expect(code).toBe("UNAUTHORIZED");
    });
  });

  describe("a Paired device outside the kitchen", () => {
    test("is rejected by every procedure that is not a kitchen one", async () => {
      const context = await asDevice(kitchenToken);
      const attempts = [
        call(
          restaurantRouter.orders.listOpenSessions,
          { locationId: seed.locations.a },
          { context },
        ),
        call(restaurantRouter.orders.getSession, { tableSessionId: sessionId }, { context }),
        call(restaurantRouter.devices.list, { locationId: seed.locations.a }, { context }),
        call(restaurantRouter.staff.listAssignments, {}, { context }),
      ];
      for (const attempt of attempts) {
        expect(await codeOf(attempt)).toBe("UNAUTHORIZED");
      }
    });
  });
});
