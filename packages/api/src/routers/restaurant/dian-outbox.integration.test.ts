import { resolveTestDatabaseUrl } from "@base-template/auth/testing";
import * as schema from "@base-template/db/schema";
import { requireTestDatabaseOrSkip } from "@base-template/db/testing";
import { call } from "@orpc/server";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";

import { backoffMs, drainOutbox } from "../../lib/invoicing/transmit";
import { seedDianScenario } from "../../testing/dian-fixtures";
import { createRestaurantHarness } from "../../testing/restaurant-fixtures";
import type { RestaurantHarness } from "../../testing/restaurant-fixtures";
import { restaurantRouter } from "./index";

const reachable = await requireTestDatabaseOrSkip(
  resolveTestDatabaseUrl(),
  "restaurant dian outbox",
);

const HOUR_MS = 3_600_000;

describe.skipIf(!reachable)("restaurant DIAN: outbox, incidents and counter", () => {
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
  });

  const deps = () => ({ db: harness.db, invoicing: harness.invoicing, clock: harness.clock });
  const advance = (ms: number) =>
    harness.clock.setNow(new Date(harness.clock.now().getTime() + ms));

  const issue = async (tableSessionId: string, extra: Record<string, unknown> = {}) =>
    call(
      restaurantRouter.dian.issueDocument,
      { tableSessionId, ...extra },
      { context: await scenario.as("cashierA") },
    );

  const asOwner = async () => scenario.as("owner");

  test("backoff doubles from one minute up to one hour", () => {
    expect([1, 2, 3, 4, 7, 20].map(backoffMs)).toEqual([
      60_000, 120_000, 240_000, 480_000, 3_600_000, 3_600_000,
    ]);
  });

  test("a drain waits for the backoff, then issues the document and closes the incident", async () => {
    harness.invoicing.setReachable(false);
    await issue(await scenario.settledSession());
    expect(await drainOutbox(deps())).toMatchObject({ attempted: 0 });

    harness.invoicing.setReachable(true);
    advance(30_000);
    expect(await drainOutbox(deps())).toMatchObject({ attempted: 0 });

    advance(31_000);
    expect(await drainOutbox(deps())).toMatchObject({ attempted: 1, issued: 1 });

    const [document] = await harness.db.select().from(schema.dianDocument);
    const [outbox] = await harness.db.select().from(schema.dianOutbox);
    const [incident] = await harness.db.select().from(schema.dianIncident);
    expect(document).toMatchObject({ status: "issued", number: "POS1" });
    expect(outbox).toMatchObject({
      attempts: 2,
      completedAt: harness.clock.now(),
      lastError: null,
    });
    expect(incident).toMatchObject({
      cause: "provider_unavailable",
      endedAt: harness.clock.now(),
      documentsCovered: 1,
    });
    expect(await drainOutbox(deps())).toMatchObject({ attempted: 0 });
  });

  test("each failed attempt backs off further and records the last error", async () => {
    harness.invoicing.setReachable(false);
    await issue(await scenario.settledSession());
    advance(61_000);
    await drainOutbox(deps());
    const [outbox] = await harness.db.select().from(schema.dianOutbox);
    expect(outbox!.attempts).toBe(2);
    expect(outbox!.nextAttemptAt).toEqual(new Date(harness.clock.now().getTime() + 120_000));
    expect(outbox!.lastError).toContain("unreachable");
  });

  test("a document that is never transmitted is flagged overdue after 48 hours, once", async () => {
    harness.invoicing.setReachable(false);
    await issue(await scenario.settledSession());
    advance(47 * HOUR_MS);
    expect(await drainOutbox(deps())).toMatchObject({ overdue: 0 });
    advance(2 * HOUR_MS);
    expect(await drainOutbox(deps())).toMatchObject({ overdue: 1 });
    expect(await drainOutbox(deps())).toMatchObject({ overdue: 0 });
    const [row] = await call(
      restaurantRouter.dian.listOutbox,
      { locationId: scenario.locationId },
      { context: await asOwner() },
    );
    expect(row).toMatchObject({ overdue: true, attempts: expect.any(Number) });
  });

  test("a rejection during a drain settles the document without retrying", async () => {
    harness.invoicing.setReachable(false);
    await issue(await scenario.settledSession());
    harness.invoicing.setReachable(true);
    harness.invoicing.script([{ reject: "Numbering range exhausted" }]);
    advance(61_000);
    expect(await drainOutbox(deps())).toMatchObject({ rejected: 1 });
    const [document] = await harness.db.select().from(schema.dianDocument);
    expect(document).toMatchObject({
      status: "rejected",
      rejectionReason: "Numbering range exhausted",
    });
    const counts = await harness.db.select().from(schema.dianDocumentCounter);
    expect(counts).toHaveLength(0);
  });

  test("a contingency sale opens an incident from its sale time and closes when transmitted", async () => {
    const offline = new Date("2026-10-01T10:00:00.000Z");
    harness.invoicing.setReachable(false);
    await issue(await scenario.settledSession({ clientRecordedAt: offline }), {
      contingency: true,
    });
    const [incident] = await harness.db.select().from(schema.dianIncident);
    expect(incident).toMatchObject({ cause: "offline_sale", startedAt: offline, endedAt: null });

    harness.invoicing.setReachable(true);
    advance(61_000);
    await drainOutbox(deps());
    const [closed] = await harness.db.select().from(schema.dianIncident);
    expect(closed).toMatchObject({ endedAt: harness.clock.now(), documentsCovered: 1 });
  });

  test("an incident stays open until every pending document of the Location is transmitted", async () => {
    harness.invoicing.setReachable(false);
    await issue(await scenario.settledSession());
    await issue(await scenario.settledSession());
    harness.invoicing.setReachable(true);
    harness.invoicing.script([{ transient: "still flaky" }]);
    advance(61_000);
    await drainOutbox(deps());
    expect((await harness.db.select().from(schema.dianIncident))[0]!.endedAt).toBeNull();
    advance(121_000);
    await drainOutbox(deps());
    expect((await harness.db.select().from(schema.dianIncident))[0]).toMatchObject({
      documentsCovered: 2,
      endedAt: harness.clock.now(),
    });
  });

  test("the outbox and incident log are listed for Cashiers and Administrators, scoped to the Location", async () => {
    harness.invoicing.setReachable(false);
    await issue(await scenario.settledSession());
    const outbox = await call(
      restaurantRouter.dian.listOutbox,
      { locationId: scenario.locationId },
      { context: await scenario.as("cashierA") },
    );
    expect(outbox).toHaveLength(1);
    const incidents = await call(
      restaurantRouter.dian.listIncidents,
      { locationId: scenario.locationId },
      { context: await scenario.as("admin") },
    );
    expect(incidents).toHaveLength(1);
    expect(
      await scenario.codeOf(
        call(
          restaurantRouter.dian.listOutbox,
          { locationId: scenario.seed.locations.b },
          { context: await scenario.as("cashierA") },
        ),
      ),
    ).toBe("FORBIDDEN");
  });

  test("document counts are for Owner and Administrator, and split by Bogota month", async () => {
    await issue(await scenario.settledSession());
    harness.clock.setNow(new Date("2026-11-01T04:30:00.000Z"));
    await issue(await scenario.settledSession());
    harness.clock.setNow(new Date("2026-11-01T05:30:00.000Z"));
    await issue(await scenario.settledSession());
    const counts = await call(
      restaurantRouter.dian.documentCounts,
      { locationId: scenario.locationId },
      { context: await scenario.as("admin") },
    );
    expect(counts).toEqual([
      { month: "2026-11", count: 1 },
      { month: "2026-10", count: 2 },
    ]);
    expect(
      await scenario.codeOf(
        call(
          restaurantRouter.dian.documentCounts,
          { locationId: scenario.locationId },
          { context: await scenario.as("cashierA") },
        ),
      ),
    ).toBe("FORBIDDEN");
  });
});
