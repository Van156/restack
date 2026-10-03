import { resolveTestDatabaseUrl } from "@base-template/auth/testing";
import * as schema from "@base-template/db/schema";
import { requireTestDatabaseOrSkip } from "@base-template/db/testing";
import { call } from "@orpc/server";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";

import { closeSettledSessionCalls } from "../../lib/waiter-call-close";
import { createGuestCall, getGuestState } from "../../lib/waiter-call-guest";
import { recordStaffSeen } from "../../lib/location-presence";
import { BILLING_TEST_TOTAL, seedBillingScenario } from "../../testing/billing-fixtures";
import {
  createRestaurantHarness,
  TEST_ACTING_TOKEN_SECRET,
} from "../../testing/restaurant-fixtures";
import type { RestaurantHarness } from "../../testing/restaurant-fixtures";
import { restaurantRouter } from "./index";

const reachable = await requireTestDatabaseOrSkip(resolveTestDatabaseUrl(), "waiter call settle");

describe.skipIf(!reachable)("waiter call: settled Bill closes the token", () => {
  let harness: RestaurantHarness;
  let scenario: Awaited<ReturnType<typeof seedBillingScenario>>;
  let sessionId: string;
  let guestToken: string;

  beforeAll(async () => {
    harness = await createRestaurantHarness();
  });
  afterAll(async () => {
    await harness.close();
  });
  beforeEach(async () => {
    scenario = await seedBillingScenario(harness);
    sessionId = await scenario.openSession();
    ({ token: guestToken } = await call(
      restaurantRouter.waiterCall.qr,
      { tableSessionId: sessionId },
      { context: await scenario.as("waiterA") },
    ));
    await recordStaffSeen(harness.db, harness.clock, {
      organizationId: scenario.seed.organizationId,
      locationId: scenario.seed.locations.a,
      memberId: scenario.seed.staff.waiterA.memberId,
    });
  });

  const guestDeps = () => ({
    db: harness.db,
    clock: harness.clock,
    secret: TEST_ACTING_TOKEN_SECRET,
  });
  const callRows = () =>
    harness.db
      .select()
      .from(schema.waiterCall)
      .where(eq(schema.waiterCall.tableSessionId, sessionId));

  async function pay() {
    const cashier = await scenario.as("cashierA");
    await call(
      restaurantRouter.billing.recordPayment,
      {
        tableSessionId: sessionId,
        tender: "cash",
        amount: BILLING_TEST_TOTAL,
        tendered: BILLING_TEST_TOTAL,
        idempotencyKey: scenario.nextKey(),
      },
      { context: cashier },
    );
    return cashier;
  }
  const settle = async () =>
    call(restaurantRouter.billing.settle, { tableSessionId: sessionId }, { context: await pay() });

  test("settling the Bill resolves the open call and the guest page closes", async () => {
    await createGuestCall(guestDeps(), guestToken, { reason: "pay", fingerprint: "f" });
    await settle();
    const [row] = await callRows();
    expect(row).toMatchObject({
      status: "attended",
      resolvedAt: harness.clock.now(),
      cooldownUntil: null,
    });
    expect(
      await call(
        restaurantRouter.waiterCall.list,
        { locationId: scenario.seed.locations.a },
        { context: await scenario.as("waiterA") },
      ),
    ).toEqual([]);
    expect(await getGuestState(guestDeps(), guestToken, "f")).toMatchObject({
      state: { status: "closed" },
    });
    expect(
      await createGuestCall(guestDeps(), guestToken, { reason: "pay", fingerprint: "f" }),
    ).toMatchObject({ kind: "refused", reason: "closed" });
  });

  test("settling a Bill leaves the calls of other Table sessions alone", async () => {
    const otherId = await scenario.openSession({
      tableId: scenario.service.tables.t2,
      lines: [{ item: "fries" }],
    });
    const { token } = await call(
      restaurantRouter.waiterCall.qr,
      { tableSessionId: otherId },
      { context: await scenario.as("waiterA") },
    );
    await createGuestCall(guestDeps(), token, { reason: "need_something", fingerprint: "f" });
    await settle();
    const [other] = await harness.db
      .select()
      .from(schema.waiterCall)
      .where(eq(schema.waiterCall.tableSessionId, otherId));
    expect(other!.status).toBe("open");
  });

  test("the fallback closes the calls of sessions settled outside the request path, once", async () => {
    await createGuestCall(guestDeps(), guestToken, { reason: "pay", fingerprint: "f" });
    await harness.db
      .update(schema.tableSession)
      .set({ status: "settled", settledAt: harness.clock.now() })
      .where(eq(schema.tableSession.id, sessionId));
    expect(await closeSettledSessionCalls(harness.db, harness.clock)).toBe(1);
    expect((await callRows())[0]).toMatchObject({
      status: "attended",
      resolvedAt: harness.clock.now(),
    });
    expect(await closeSettledSessionCalls(harness.db, harness.clock)).toBe(0);
  });

  test("the fallback leaves calls of unsettled sessions open", async () => {
    await createGuestCall(guestDeps(), guestToken, { reason: "pay", fingerprint: "f" });
    expect(await closeSettledSessionCalls(harness.db, harness.clock)).toBe(0);
    expect((await callRows())[0]!.status).toBe("open");
  });
});
